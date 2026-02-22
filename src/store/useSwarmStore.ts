import { create } from "zustand";
import type { PeerInfo, PeerRole, PeerStatus } from "@/types/mesh";
import type { FileMetadata, TransferState, TransferStats } from "@/types/transfer";

export interface ChatMessage {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
  timestamp: number;
  isOwn: boolean;
}

export type FileTransferStatus = "pending" | "sending" | "receiving" | "complete";

export interface FileStatus {
  fileId: string;
  status: FileTransferStatus;
  direction: "sending" | "receiving";
  chunksReceived: number;
  totalChunks: number;
  startedAt: number;
  completedAt: number | null;
  bytesReceived: number;
  totalBytes: number;
}

interface SwarmStoreState {
  roomCode: string;
  myPeerId: string;
  isHost: boolean;
  peers: Record<string, PeerInfo>;
  files: FileMetadata[];
  fileStatuses: Record<string, FileStatus>;
  transferState: TransferState;
  stats: TransferStats;
  fileHash: string | null;
  error: string | null;
  chatMessages: ChatMessage[];

  setRoomCode: (code: string) => void;
  setMyPeerId: (id: string) => void;
  setIsHost: (isHost: boolean) => void;
  setFiles: (files: FileMetadata[]) => void;
  setTransferState: (state: TransferState) => void;
  setFileHash: (hash: string | null) => void;
  setError: (error: string | null) => void;

  addPeer: (id: string, displayName: string, role: PeerRole) => void;
  removePeer: (id: string) => void;
  updatePeerStatus: (id: string, status: PeerStatus) => void;
  updatePeerProgress: (id: string, chunksHave: number, totalChunks: number) => void;
  updatePeerSpeed: (id: string, uploadSpeed: number, downloadSpeed: number) => void;
  updatePeerBitfield: (id: string, bitfield: Uint8Array) => void;

  // Per-file status
  setFileStatus: (fileId: string, status: Partial<FileStatus>) => void;
  initFileStatus: (fileId: string, totalChunks: number, totalBytes: number, initialStatus?: FileTransferStatus) => void;
  incrementFileChunk: (fileId: string, chunkBytes: number) => void;
  completeFile: (fileId: string) => void;

  updateStats: (partial: Partial<TransferStats>) => void;
  incrementChunksCompleted: () => void;

  addChatMessage: (msg: ChatMessage) => void;

  reset: () => void;
}

const initialStats: TransferStats = {
  bytesTransferred: 0,
  totalBytes: 0,
  speed: 0,
  eta: 0,
  chunksCompleted: 0,
  totalChunks: 0,
  startTime: 0,
  peakSpeed: 0,
};

export const useSwarmStore = create<SwarmStoreState>((set) => ({
  roomCode: "",
  myPeerId: "",
  isHost: false,
  peers: {},
  files: [],
  fileStatuses: {},
  transferState: "idle",
  stats: { ...initialStats },
  fileHash: null,
  error: null,
  chatMessages: [],

  setRoomCode: (code) => set({ roomCode: code }),
  setMyPeerId: (id) => set({ myPeerId: id }),
  setIsHost: (isHost) => set({ isHost }),
  setFiles: (files) => set({ files }),
  setTransferState: (state) => set({ transferState: state }),
  setFileHash: (hash) => set({ fileHash: hash }),
  setError: (error) => set({ error }),

  addPeer: (id, displayName, role) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [id]: {
          id,
          displayName,
          role,
          status: "connecting",
          uploadSpeed: 0,
          downloadSpeed: 0,
          chunksHave: 0,
          totalChunks: 0,
          connectionCount: 0,
          bitfield: new Uint8Array(0),
          lastSeen: Date.now(),
        },
      },
    })),

  removePeer: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.peers;
      return { peers: rest };
    }),

  updatePeerStatus: (id, status) =>
    set((state) => {
      if (!state.peers[id]) return state;
      return {
        peers: {
          ...state.peers,
          [id]: { ...state.peers[id], status, lastSeen: Date.now() },
        },
      };
    }),

  updatePeerProgress: (id, chunksHave, totalChunks) =>
    set((state) => {
      if (!state.peers[id]) return state;
      return {
        peers: {
          ...state.peers,
          [id]: { ...state.peers[id], chunksHave, totalChunks, lastSeen: Date.now() },
        },
      };
    }),

  updatePeerSpeed: (id, uploadSpeed, downloadSpeed) =>
    set((state) => {
      if (!state.peers[id]) return state;
      return {
        peers: {
          ...state.peers,
          [id]: { ...state.peers[id], uploadSpeed, downloadSpeed, lastSeen: Date.now() },
        },
      };
    }),

  updatePeerBitfield: (id, bitfield) =>
    set((state) => {
      if (!state.peers[id]) return state;
      return {
        peers: {
          ...state.peers,
          [id]: { ...state.peers[id], bitfield, lastSeen: Date.now() },
        },
      };
    }),

  // ---- Per-file status tracking ----

  initFileStatus: (fileId, totalChunks, totalBytes, initialStatus = "pending") =>
    set((state) => ({
      fileStatuses: {
        ...state.fileStatuses,
        [fileId]: {
          fileId,
          status: initialStatus,
          direction: initialStatus === "receiving" ? "receiving" as const : "sending" as const,
          chunksReceived: 0,
          totalChunks,
          startedAt: Date.now(),
          completedAt: null,
          bytesReceived: 0,
          totalBytes,
        },
      },
    })),

  setFileStatus: (fileId, partial) =>
    set((state) => ({
      fileStatuses: {
        ...state.fileStatuses,
        [fileId]: { ...state.fileStatuses[fileId], ...partial },
      },
    })),

  incrementFileChunk: (fileId, chunkBytes) =>
    set((state) => {
      const current = state.fileStatuses[fileId];
      if (!current) return state;
      const newChunks = current.chunksReceived + 1;
      const newBytes = current.bytesReceived + chunkBytes;
      return {
        fileStatuses: {
          ...state.fileStatuses,
          [fileId]: {
            ...current,
            chunksReceived: newChunks,
            bytesReceived: newBytes,
            status: newChunks >= current.totalChunks ? "complete" : current.status,
            completedAt: newChunks >= current.totalChunks ? Date.now() : null,
          },
        },
      };
    }),

  completeFile: (fileId) =>
    set((state) => {
      const current = state.fileStatuses[fileId];
      if (!current) return state;
      return {
        fileStatuses: {
          ...state.fileStatuses,
          [fileId]: {
            ...current,
            status: "complete",
            completedAt: Date.now(),
          },
        },
      };
    }),

  updateStats: (partial) =>
    set((state) => ({
      stats: {
        ...state.stats,
        ...partial,
        peakSpeed: Math.max(state.stats.peakSpeed, partial.speed ?? state.stats.speed),
      },
    })),

  incrementChunksCompleted: () =>
    set((state) => ({
      stats: {
        ...state.stats,
        chunksCompleted: state.stats.chunksCompleted + 1,
      },
    })),

  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, msg],
    })),

  reset: () =>
    set({
      roomCode: "",
      myPeerId: "",
      isHost: false,
      peers: {},
      files: [],
      fileStatuses: {},
      transferState: "idle",
      stats: { ...initialStats },
      fileHash: null,
      error: null,
      chatMessages: [],
    }),
}));
