export type PeerRole = "seeder" | "leecher" | "peer";
export type PeerStatus = "connecting" | "active" | "choked" | "disconnected";

export interface PeerInfo {
  id: string;
  displayName: string;
  role: PeerRole;
  status: PeerStatus;
  uploadSpeed: number;
  downloadSpeed: number;
  chunksHave: number;
  totalChunks: number;
  connectionCount: number;
  bitfield: Uint8Array;
  lastSeen: number;
}

export interface SwarmState {
  roomCode: string;
  myPeerId: string;
  peers: Map<string, PeerInfo>;
  isHost: boolean;
  totalPeers: number;
  combinedSpeed: number;
  eta: number;
}

export interface MeshConfig {
  maxConnections: number;
  maxPeers: number;
  chunkSize: number;
}
