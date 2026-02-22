import { MAX_CONNECTIONS } from "@/types/transfer";

export function selectPeersToConnect(
  allPeerIds: string[],
  myId: string,
  existingConnections: string[]
): string[] {
  const available = allPeerIds.filter(
    (id) => id !== myId && !existingConnections.includes(id)
  );

  const slotsAvailable = MAX_CONNECTIONS - existingConnections.length;
  if (slotsAvailable <= 0) return [];

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, slotsAvailable);
}

export function shouldAcceptConnection(
  currentConnectionCount: number
): boolean {
  return currentConnectionCount < MAX_CONNECTIONS;
}

export function getConnectionCount(connections: Map<string, unknown>): number {
  return connections.size;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const values = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) {
    code += chars[values[i] % chars.length];
  }
  return code;
}

export function generatePeerId(): string {
  const values = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(values)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
