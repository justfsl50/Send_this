import { io, type Socket } from "socket.io-client";
import type { SignalMessage } from "@/types/messages";

type SignalEventHandler = (message: SignalMessage) => void;

class SignalingClient {
  private socket: Socket | null = null;
  private handlers: Map<string, SignalEventHandler[]> = new Map();

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect", () => {
        resolve();
      });

      this.socket.on("connect_error", (err) => {
        reject(err);
      });

      this.socket.on("signal", (message: SignalMessage) => {
        const handlers = this.handlers.get(message.type) || [];
        handlers.forEach((handler) => handler(message));
      });

      this.socket.on("disconnect", () => {
        const handlers = this.handlers.get("disconnect") || [];
        handlers.forEach((handler) =>
          handler({
            type: "error",
            roomCode: "",
            peerId: "",
            data: { reason: "disconnected" },
          })
        );
      });
    });
  }

  on(event: string, handler: SignalEventHandler): void {
    const existing = this.handlers.get(event) || [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  off(event: string, handler: SignalEventHandler): void {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(
      event,
      existing.filter((h) => h !== handler)
    );
  }

  send(message: SignalMessage): void {
    this.socket?.emit("signal", message);
  }

  joinRoom(roomCode: string, peerId: string): void {
    this.send({
      type: "join-room",
      roomCode,
      peerId,
    });
  }

  sendSignal(
    roomCode: string,
    peerId: string,
    targetPeerId: string,
    signalData: Record<string, unknown>
  ): void {
    this.send({
      type: "signal",
      roomCode,
      peerId,
      targetPeerId,
      data: signalData,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.handlers.clear();
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const signalingClient = new SignalingClient();
