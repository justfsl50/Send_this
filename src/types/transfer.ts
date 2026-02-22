export const CHUNK_SIZE = 64 * 1024;
export const MAX_PEERS = 20;
export const MAX_CONNECTIONS = 5;

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  hash?: string;
}

export interface ChunkData {
  fileId: string;
  index: number;
  data: ArrayBuffer;
  hash: string;
  verified: boolean;
}

export interface TransferStats {
  bytesTransferred: number;
  totalBytes: number;
  speed: number;
  eta: number;
  chunksCompleted: number;
  totalChunks: number;
  startTime: number;
  peakSpeed: number;
}

export type TransferState = "idle" | "waiting" | "active" | "paused" | "complete" | "error";

export interface TransferSession {
  roomCode: string;
  files: FileMetadata[];
  state: TransferState;
  stats: TransferStats;
  error?: string;
}
