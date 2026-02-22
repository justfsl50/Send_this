import Peer, { type Instance as SimplePeerInstance } from "simple-peer";

export interface PeerConnection {
  peer: SimplePeerInstance;
  peerId: string;
  connected: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "2f261de2206b3b5a667a143c",
    credential: "ioc4UwMcqjma+grF",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "2f261de2206b3b5a667a143c",
    credential: "ioc4UwMcqjma+grF",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "2f261de2206b3b5a667a143c",
    credential: "ioc4UwMcqjma+grF",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "2f261de2206b3b5a667a143c",
    credential: "ioc4UwMcqjma+grF",
  },
];

/**
 * Create a WebRTC peer connection using simple-peer.
 * 
 * Key design choice: The data channel is RELIABLE and ORDERED.
 * - No maxRetransmits (reliable delivery)
 * - ordered: true (chunks arrive in sequence)
 * 
 * This is critical for file transfer — we can't afford lost chunks.
 */
export function createPeerConnection(
  initiator: boolean,
  peerId: string,
  onSignal: (data: Peer.SignalData) => void,
  onData: (data: Uint8Array) => void,
  onConnect: () => void,
  onClose: () => void,
  onError: (err: Error) => void,
  iceServers?: RTCIceServer[]
): PeerConnection {
  console.log(`[WebRTC] createPeerConnection peer=${peerId} initiator=${initiator}`);

  const peer = new Peer({
    initiator,
    trickle: true,
    channelConfig: {
      ordered: true,
    },
    config: {
      iceServers: iceServers || ICE_SERVERS,
    },
  });

  peer.on("signal", (data) => {
    console.log(`[WebRTC] signal peer=${peerId} type=${(data as Record<string, unknown>).type || "candidate"}`);
    onSignal(data);
  });

  peer.on("data", (rawData: unknown) => {
    // simple-peer can deliver data as ArrayBuffer, Buffer, or Uint8Array
    // depending on browser and message type. Normalize to Uint8Array.
    let data: Uint8Array;
    if (rawData instanceof Uint8Array) {
      data = rawData;
    } else if (rawData instanceof ArrayBuffer) {
      data = new Uint8Array(rawData);
    } else if (typeof rawData === 'object' && rawData !== null && 'buffer' in rawData) {
      // Buffer (Node.js polyfill) - has .buffer property pointing to ArrayBuffer
      const bufferLike = rawData as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
      data = new Uint8Array(bufferLike.buffer, bufferLike.byteOffset, bufferLike.byteLength);
    } else {
      console.warn('[WebRTC] unexpected data type:', typeof rawData);
      return;
    }
    onData(data);
  });

  peer.on("connect", () => {
    console.log(`[WebRTC] ✅ CONNECTED to peer=${peerId}`);
    onConnect();
  });

  peer.on("close", () => {
    console.log(`[WebRTC] ❌ CLOSED peer=${peerId}`);
    onClose();
  });

  peer.on("error", (err) => {
    console.error(`[WebRTC] ERROR peer=${peerId}`, err.message);
    onError(err);
  });

  return { peer, peerId, connected: false };
}

export function signalPeer(connection: PeerConnection, signalData: Peer.SignalData): void {
  try {
    if (!connection.peer.destroyed) {
      connection.peer.signal(signalData);
    }
  } catch (e) {
    console.warn(`[WebRTC] signalPeer failed for ${connection.peerId}`, e);
  }
}

/**
 * Send raw binary data over the data channel.
 * Returns false if the peer is not connected or send fails.
 */
export function sendRaw(connection: PeerConnection, data: Uint8Array): boolean {
  try {
    if (!connection.peer.destroyed && connection.connected) {
      connection.peer.send(data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Send a JSON control message (handshake, metadata, chat, etc.)
 */
export function sendJSON(connection: PeerConnection, obj: Record<string, unknown>): boolean {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  // Prefix with 0x00 to distinguish from chunk messages (which start with 0x01)
  const prefixed = new Uint8Array(1 + bytes.length);
  prefixed[0] = 0x00; // Control message marker
  prefixed.set(bytes, 1);
  return sendRaw(connection, prefixed);
}

/**
 * Send a file chunk with a binary header.
 * Format: [0x01][4 bytes headerLen][JSON header][chunk data]
 * The 0x01 prefix distinguishes chunks from control messages.
 */
export function sendChunk(
  connection: PeerConnection,
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
  chunkData: ArrayBuffer
): boolean {
  const header = JSON.stringify({
    fileId,
    i: chunkIndex,
    t: totalChunks,
    len: chunkData.byteLength,
  });
  const headerBytes = new TextEncoder().encode(header);
  const headerLen = new Uint32Array([headerBytes.length]);

  // [marker(1)] + [headerLen(4)] + [header(N)] + [data(M)]
  const msg = new Uint8Array(1 + 4 + headerBytes.length + chunkData.byteLength);
  msg[0] = 0x01; // Chunk message marker
  msg.set(new Uint8Array(headerLen.buffer), 1);
  msg.set(headerBytes, 5);
  msg.set(new Uint8Array(chunkData), 5 + headerBytes.length);

  return sendRaw(connection, msg);
}

/**
 * Normalize input to Uint8Array regardless of source type.
 */
function toUint8Array(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data === 'object' && data !== null && 'buffer' in data) {
    const typed = data as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
    return new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  }
  return null;
}

/**
 * Parse an incoming message. Returns either a control message or a chunk.
 */
export function parseMessage(raw: unknown):
  | { kind: "control"; payload: Record<string, unknown> }
  | { kind: "chunk"; fileId: string; chunkIndex: number; totalChunks: number; data: ArrayBuffer }
  | null {
  const data = toUint8Array(raw);
  if (!data || data.byteLength === 0) {
    console.warn('[WebRTC] parseMessage: could not normalize data, type:', typeof raw);
    return null;
  }

  const marker = data[0];

  if (marker === 0x00) {
    // Control message
    try {
      const json = new TextDecoder().decode(data.subarray(1));
      return { kind: "control", payload: JSON.parse(json) };
    } catch (e) {
      console.warn('[WebRTC] parseMessage: failed to parse control message', e);
      return null;
    }
  }

  if (marker === 0x01) {
    // Chunk message
    try {
      // Read 4-byte header length (must copy to aligned buffer for Uint32Array)
      const lenBytes = new Uint8Array(4);
      lenBytes[0] = data[1];
      lenBytes[1] = data[2];
      lenBytes[2] = data[3];
      lenBytes[3] = data[4];
      const headerLen = new DataView(lenBytes.buffer).getUint32(0, true); // little-endian

      const headerBytes = data.subarray(5, 5 + headerLen);
      const header = JSON.parse(new TextDecoder().decode(headerBytes));

      // Copy chunk data to a new ArrayBuffer (detach from the original)
      const chunkStart = 5 + headerLen;
      const chunkSlice = data.subarray(chunkStart);
      const chunkData = new ArrayBuffer(chunkSlice.byteLength);
      new Uint8Array(chunkData).set(chunkSlice);

      return {
        kind: "chunk",
        fileId: header.fileId,
        chunkIndex: header.i,
        totalChunks: header.t,
        data: chunkData,
      };
    } catch (e) {
      console.warn('[WebRTC] parseMessage: failed to parse chunk message', e);
      return null;
    }
  }

  // Try legacy JSON parse (backward compatibility / no marker)
  try {
    const json = new TextDecoder().decode(data);
    return { kind: "control", payload: JSON.parse(json) };
  } catch {
    console.warn('[WebRTC] parseMessage: unknown marker byte:', marker, 'data length:', data.byteLength);
    return null;
  }
}

export function destroyPeer(connection: PeerConnection): void {
  try {
    if (!connection.peer.destroyed) {
      connection.peer.destroy();
    }
  } catch {
    // Already destroyed
  }
}
