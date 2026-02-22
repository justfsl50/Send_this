"use client";

import { useCallback, useRef } from "react";
import {
  createPeerConnection,
  getIceServers,
  signalPeer,
  destroyPeer,
  sendJSON,
  sendChunk as sendChunkRaw,
  parseMessage,
  type PeerConnection,
} from "@/lib/webrtc";
import type Peer from "simple-peer";

interface UseWebRTCOptions {
  onControl: (peerId: string, payload: Record<string, unknown>) => void;
  onChunk: (peerId: string, fileId: string, chunkIndex: number, totalChunks: number, data: ArrayBuffer) => void;
  onConnect: (peerId: string) => void;
  onClose: (peerId: string) => void;
  onError: (peerId: string, error: Error) => void;
  onSignal: (peerId: string, signalData: Peer.SignalData) => void;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const connectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const createConnection = useCallback(
    async (peerId: string, initiator: boolean) => {
      // Destroy existing connection if any
      if (connectionsRef.current.has(peerId)) {
        destroyPeer(connectionsRef.current.get(peerId)!);
        connectionsRef.current.delete(peerId);
      }

      // Fetch fresh TURN credentials
      const iceServers = await getIceServers();

      const connection = createPeerConnection(
        initiator,
        peerId,
        // onSignal
        (signalData) => optionsRef.current.onSignal(peerId, signalData),
        // onData
        (rawData) => {
          const msg = parseMessage(rawData);
          if (!msg) {
            console.warn(`[useWebRTC] parseMessage returned null for data from ${peerId}, raw type:`, typeof rawData, rawData instanceof ArrayBuffer ? 'ArrayBuffer' : rawData instanceof Uint8Array ? 'Uint8Array' : 'other');
            return;
          }

          if (msg.kind === "control") {
            optionsRef.current.onControl(peerId, msg.payload);
          } else if (msg.kind === "chunk") {
            console.log(`[useWebRTC] chunk received: file=${msg.fileId.slice(0, 20)}... chunk=${msg.chunkIndex}/${msg.totalChunks} size=${msg.data.byteLength}`);
            optionsRef.current.onChunk(peerId, msg.fileId, msg.chunkIndex, msg.totalChunks, msg.data);
          }
        },
        // onConnect
        () => {
          const conn = connectionsRef.current.get(peerId);
          if (conn) conn.connected = true;
          optionsRef.current.onConnect(peerId);
        },
        // onClose
        () => {
          connectionsRef.current.delete(peerId);
          optionsRef.current.onClose(peerId);
        },
        // onError
        (err) => optionsRef.current.onError(peerId, err),
        iceServers
      );

      connectionsRef.current.set(peerId, connection);
      return connection;
    },
    []
  );

  const handleSignal = useCallback(
    (peerId: string, signalData: Peer.SignalData) => {
      const connection = connectionsRef.current.get(peerId);
      if (connection) {
        signalPeer(connection, signalData);
      }
    },
    []
  );

  /** Send a JSON control message to a specific peer */
  const sendMessage = useCallback(
    (peerId: string, message: Record<string, unknown>): boolean => {
      const connection = connectionsRef.current.get(peerId);
      if (!connection?.connected) return false;
      return sendJSON(connection, message);
    },
    []
  );

  /** Send a file chunk to a specific peer */
  const sendChunk = useCallback(
    (peerId: string, fileId: string, chunkIndex: number, totalChunks: number, chunkData: ArrayBuffer): boolean => {
      const connection = connectionsRef.current.get(peerId);
      if (!connection?.connected) return false;
      return sendChunkRaw(connection, fileId, chunkIndex, totalChunks, chunkData);
    },
    []
  );

  /** Send a JSON control message to ALL connected peers */
  const broadcast = useCallback(
    (message: Record<string, unknown>) => {
      connectionsRef.current.forEach((conn) => {
        if (conn.connected) {
          sendJSON(conn, message);
        }
      });
    },
    []
  );

  const disconnect = useCallback((peerId: string) => {
    const connection = connectionsRef.current.get(peerId);
    if (connection) {
      destroyPeer(connection);
      connectionsRef.current.delete(peerId);
    }
  }, []);

  const disconnectAll = useCallback(() => {
    connectionsRef.current.forEach((conn) => destroyPeer(conn));
    connectionsRef.current.clear();
  }, []);

  const hasConnection = useCallback((peerId: string) => {
    return connectionsRef.current.has(peerId);
  }, []);

  const isConnected = useCallback((peerId: string) => {
    return connectionsRef.current.get(peerId)?.connected ?? false;
  }, []);

  const getConnectedPeerIds = useCallback((): string[] => {
    const ids: string[] = [];
    connectionsRef.current.forEach((conn, pid) => {
      if (conn.connected) ids.push(pid);
    });
    return ids;
  }, []);

  return {
    createConnection,
    handleSignal,
    sendMessage,
    sendChunk,
    broadcast,
    disconnect,
    disconnectAll,
    hasConnection,
    isConnected,
    getConnectedPeerIds,
  };
}
