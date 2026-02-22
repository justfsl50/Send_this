import type { FileMetadata } from "./transfer";

export type SignalMessageType =
  | "join-room"
  | "room-joined"
  | "peer-joined"
  | "peer-left"
  | "signal"
  | "room-full"
  | "room-not-found"
  | "error";

export type DataMessageType =
  | "handshake"
  | "bitfield"
  | "request"
  | "piece"
  | "have"
  | "choke"
  | "unchoke"
  | "interested"
  | "not-interested"
  | "file-metadata"
  | "transfer-start"
  | "transfer-complete"
  | "cancel"
  | "text-message";

export interface SignalMessage {
  type: SignalMessageType;
  roomCode: string;
  peerId: string;
  targetPeerId?: string;
  data?: Record<string, unknown>;
}

export interface HandshakeMessage {
  type: "handshake";
  peerId: string;
  displayName: string;
  isHost: boolean;
}

export interface BitfieldMessage {
  type: "bitfield";
  fileId: string;
  bitfield: ArrayBuffer;
}

export interface RequestMessage {
  type: "request";
  fileId: string;
  chunkIndex: number;
}

export interface PieceMessage {
  type: "piece";
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  hash: string;
}

export interface HaveMessage {
  type: "have";
  fileId: string;
  chunkIndex: number;
}

export interface FileMetadataMessage {
  type: "file-metadata";
  files: FileMetadata[];
}

export interface ChokeMessage {
  type: "choke" | "unchoke";
}

export interface InterestMessage {
  type: "interested" | "not-interested";
}

export interface TextMessage {
  type: "text-message";
  id: string;
  text: string;
  senderName: string;
  timestamp: number;
}

export type DataMessage =
  | HandshakeMessage
  | BitfieldMessage
  | RequestMessage
  | PieceMessage
  | HaveMessage
  | FileMetadataMessage
  | ChokeMessage
  | InterestMessage
  | TextMessage
  | { type: "transfer-start" }
  | { type: "transfer-complete" }
  | { type: "cancel" };
