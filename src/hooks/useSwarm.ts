"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSwarmStore } from "@/store/useSwarmStore";
import { useWebRTC } from "./useWebRTC";
import { signalingClient } from "@/lib/socket";
import { generatePeerId } from "@/lib/mesh";
import { requestWakeLock, releaseWakeLock } from "@/lib/wakeLock";
import { CHUNK_SIZE } from "@/types/transfer";
import type { FileMetadata } from "@/types/transfer";
import type { SignalMessage } from "@/types/messages";
import type Peer from "simple-peer";

const SIGNAL_SERVER = process.env.NEXT_PUBLIC_SIGNAL_SERVER || "ws://localhost:3001";
const MAX_CONNECTIONS = 5;

/**
 * useSwarm — peer-to-peer file transfer
 *
 * Features:
 * - Auto-send: dropping a file immediately sends it to connected peers
 * - Late joiners: new peers automatically receive all previously shared files
 * - Per-file tracking: individual progress, timing, completion status
 * - Individual downloads: receiver can download each file separately
 */

export function useSwarm(roomCode: string, isHost: boolean) {
  const store = useSwarmStore();

  const myPeerIdRef = useRef("");
  const myDisplayNameRef = useRef(isHost ? "Host" : "");
  const connectedPeersRef = useRef<Set<string>>(new Set());
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Host-side: all shared files (fileId -> File object)
  const sharedFilesRef = useRef<Map<string, File>>(new Map());
  const sharedMetaRef = useRef<FileMetadata[]>([]);
  const sendingRef = useRef(false);
  const sendQueueRef = useRef<{ file: File; meta: FileMetadata }[]>([]);

  // Receiver-side: chunk storage
  const receivedChunksRef = useRef<Map<string, Map<number, ArrayBuffer>>>(new Map());
  const speedTrackRef = useRef({ bytes: 0, lastTime: Date.now() });

  // ---- Helper: push one file's chunks to one peer ----

  const pushFileToPeer = useCallback(async (peerId: string, file: File, meta: FileMetadata) => {
    const totalChunks = meta.totalChunks;
    for (let ci = 0; ci < totalChunks; ci++) {
      const start = ci * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      const chunkData = await blob.arrayBuffer();
      webrtc.sendChunk(peerId, meta.id, ci, totalChunks, chunkData);

      if (ci % 3 === 0) {
        await new Promise(r => setTimeout(r, 5));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Helper: send a single file to all connected peers ----

  const sendFileToAllPeers = useCallback(async (file: File, meta: FileMetadata) => {
    const peerIds = webrtc.getConnectedPeerIds();
    if (peerIds.length === 0) return;

    const s = useSwarmStore.getState();

    // Init per-file status on host side
    s.initFileStatus(meta.id, meta.totalChunks, meta.size, "sending");

    // Send updated file-offer with ALL shared files
    webrtc.broadcast({
      type: "file-offer",
      files: sharedMetaRef.current,
    });

    await new Promise(r => setTimeout(r, 150));

    // Push chunks
    const totalChunks = meta.totalChunks;
    for (let ci = 0; ci < totalChunks; ci++) {
      const start = ci * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      const chunkData = await blob.arrayBuffer();

      for (const pid of peerIds) {
        webrtc.sendChunk(pid, meta.id, ci, totalChunks, chunkData);
      }

      // Update per-file progress on sender side
      s.incrementFileChunk(meta.id, chunkData.byteLength);

      if (ci % 3 === 0) {
        await new Promise(r => setTimeout(r, 5));
      }
    }

    // Mark complete on sender
    s.completeFile(meta.id);
    console.log(`[Swarm] ✅ file "${meta.name}" sent (${totalChunks} chunks)`);

    // Notify receivers this file is done
    webrtc.broadcast({ type: "file-complete", fileId: meta.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Send queue processor: sends files one at a time ----

  const processSendQueue = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    while (sendQueueRef.current.length > 0) {
      const item = sendQueueRef.current.shift()!;
      await sendFileToAllPeers(item.file, item.meta);
    }

    sendingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendFileToAllPeers]);

  // ---- WebRTC callbacks ----

  const handleControl = useCallback((peerId: string, msg: Record<string, unknown>) => {
    console.log(`[Swarm] control from ${peerId}:`, msg.type);

    switch (msg.type) {
      case "handshake": {
        const displayName = (msg.displayName as string) || `Peer-${peerId.slice(0, 4)}`;
        const peerIsHost = msg.isHost as boolean;
        const s = useSwarmStore.getState();
        s.addPeer(peerId, displayName, peerIsHost ? "seeder" : "leecher");
        s.updatePeerStatus(peerId, "active");

        // HOST: Send all shared files to late joiner
        if (isHost && sharedMetaRef.current.length > 0) {
          console.log(`[Swarm] sending ${sharedMetaRef.current.length} file(s) to late joiner ${peerId.slice(0, 8)}`);

          webrtc.sendMessage(peerId, {
            type: "file-offer",
            files: sharedMetaRef.current,
          });

          setTimeout(async () => {
            for (const meta of sharedMetaRef.current) {
              const file = sharedFilesRef.current.get(meta.id);
              if (file) {
                await pushFileToPeer(peerId, file, meta);
                webrtc.sendMessage(peerId, { type: "file-complete", fileId: meta.id });
              }
            }
            console.log(`[Swarm] finished sending to late joiner ${peerId.slice(0, 8)}`);
          }, 300);
        }
        break;
      }

      case "file-offer": {
        // RECEIVER: merge new file metadata
        const newFiles = msg.files as FileMetadata[];
        console.log(`[Swarm] received file-offer: ${newFiles.length} file(s)`);
        const s = useSwarmStore.getState();

        const existingIds = new Set(s.files.map(f => f.id));
        const toAdd = newFiles.filter(f => !existingIds.has(f.id));
        const allFiles = [...s.files, ...toAdd];
        s.setFiles(allFiles);

        if (allFiles.length > 0 && s.transferState === "idle") {
          s.setTransferState("active");
        }

        // Init per-file status for new files
        for (const f of toAdd) {
          if (!receivedChunksRef.current.has(f.id)) {
            receivedChunksRef.current.set(f.id, new Map());
          }
          s.initFileStatus(f.id, f.totalChunks, f.size, "receiving");
        }

        // Recalculate total stats
        s.updateStats({
          totalBytes: allFiles.reduce((a, f) => a + f.size, 0),
          totalChunks: allFiles.reduce((a, f) => a + f.totalChunks, 0),
          startTime: s.stats.startTime || Date.now(),
        });
        break;
      }

      case "file-complete": {
        const fileId = msg.fileId as string;
        console.log(`[Swarm] sender says file ${fileId.slice(0, 20)}... is complete`);
        // Check if we actually have all chunks
        const s = useSwarmStore.getState();
        const fileMeta = s.files.find(f => f.id === fileId);
        const chunks = receivedChunksRef.current.get(fileId);
        if (fileMeta && chunks && chunks.size >= fileMeta.totalChunks) {
          s.completeFile(fileId);
        }
        checkAllComplete();
        break;
      }

      case "transfer-complete": {
        console.log(`[Swarm] sender says transfer-complete`);
        checkAllComplete();
        break;
      }

      case "text-message": {
        useSwarmStore.getState().addChatMessage({
          id: (msg.id as string) || crypto.randomUUID(),
          text: msg.text as string,
          senderName: (msg.senderName as string) || `Peer-${peerId.slice(0, 4)}`,
          senderId: peerId,
          timestamp: (msg.timestamp as number) || Date.now(),
          isOwn: false,
        });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  const handleChunk = useCallback(
    (_peerId: string, fileId: string, chunkIndex: number, totalChunks: number, data: ArrayBuffer) => {
      if (!receivedChunksRef.current.has(fileId)) {
        receivedChunksRef.current.set(fileId, new Map());
      }
      const fileChunks = receivedChunksRef.current.get(fileId)!;
      if (fileChunks.has(chunkIndex)) return;

      fileChunks.set(chunkIndex, data);

      const s = useSwarmStore.getState();
      s.incrementChunksCompleted();
      speedTrackRef.current.bytes += data.byteLength;
      s.updateStats({
        bytesTransferred: s.stats.bytesTransferred + data.byteLength,
      });

      // Update per-file progress
      s.incrementFileChunk(fileId, data.byteLength);

      // Check if this specific file is complete
      if (fileChunks.size >= totalChunks) {
        console.log(`[Swarm] ✅ file complete: ${fileId.slice(0, 20)}... (${totalChunks} chunks)`);
        s.completeFile(fileId);
        checkAllComplete();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const checkAllComplete = useCallback(() => {
    const s = useSwarmStore.getState();
    if (s.files.length === 0) return;

    const allDone = s.files.every(f => {
      const chunks = receivedChunksRef.current.get(f.id);
      return chunks && chunks.size >= f.totalChunks;
    });

    if (allDone && s.transferState !== "complete") {
      console.log(`[Swarm] 🎉 ALL FILES COMPLETE!`);
      s.setTransferState("complete");
    }
  }, []);

  // ---- WebRTC setup ----

  const webrtc = useWebRTC({
    onControl: handleControl,
    onChunk: handleChunk,
    onConnect: (peerId: string) => {
      console.log(`[Swarm] peer connected: ${peerId}`);
      connectedPeersRef.current.add(peerId);
      retryCountRef.current.delete(peerId);
      useSwarmStore.getState().updatePeerStatus(peerId, "active");

      webrtc.sendMessage(peerId, {
        type: "handshake",
        peerId: myPeerIdRef.current,
        displayName: myDisplayNameRef.current || (isHost ? "Host" : `Peer-${myPeerIdRef.current.slice(0, 4)}`),
        isHost,
      });
    },
    onClose: (peerId: string) => {
      connectedPeersRef.current.delete(peerId);
      useSwarmStore.getState().updatePeerStatus(peerId, "disconnected");
    },
    onError: (peerId: string, error: Error) => {
      console.error(`[Swarm] peer error: ${peerId}`, error.message);
      connectedPeersRef.current.delete(peerId);
      useSwarmStore.getState().updatePeerStatus(peerId, "disconnected");

      // Auto-retry connection (up to 3 attempts)
      const retryCount = retryCountRef.current.get(peerId) || 0;
      if (retryCount < 3) {
        retryCountRef.current.set(peerId, retryCount + 1);
        const delay = 1000 * (retryCount + 1); // 1s, 2s, 3s
        console.log(`[Swarm] retrying peer ${peerId} in ${delay}ms (attempt ${retryCount + 1}/3)`);
        setTimeout(() => {
          if (!connectedPeersRef.current.has(peerId)) {
            webrtc.createConnection(peerId, true);
          }
        }, delay);
      }
    },
    onSignal: (peerId: string, signalData: Peer.SignalData) => {
      signalingClient.sendSignal(
        roomCode,
        myPeerIdRef.current,
        peerId,
        signalData as unknown as Record<string, unknown>
      );
    },
  });

  // ---- Room management ----

  const joinRoom = useCallback(async () => {
    const myId = generatePeerId();
    myPeerIdRef.current = myId;
    store.setMyPeerId(myId);
    store.setRoomCode(roomCode);
    store.setIsHost(isHost);

    try {
      await signalingClient.connect(SIGNAL_SERVER);
      console.log(`[Swarm] connected to signaling server`);
    } catch (e) {
      console.error(`[Swarm] signaling connection failed`, e);
      store.setError("Failed to connect to signaling server");
      return;
    }

    signalingClient.on("peer-joined", (msg: SignalMessage) => {
      if (msg.peerId === myId) return;
      store.addPeer(msg.peerId, `Peer-${msg.peerId.slice(0, 4)}`, "leecher");
    });

    signalingClient.on("peer-left", (msg: SignalMessage) => {
      store.removePeer(msg.peerId);
      webrtc.disconnect(msg.peerId);
      connectedPeersRef.current.delete(msg.peerId);
    });

    signalingClient.on("signal", (msg: SignalMessage) => {
      if (msg.targetPeerId !== myId) return;
      const signalData = msg.data as unknown as Peer.SignalData;

      if (!webrtc.hasConnection(msg.peerId)) {
        if (connectedPeersRef.current.size < MAX_CONNECTIONS) {
          store.addPeer(msg.peerId, `Peer-${msg.peerId.slice(0, 4)}`, "leecher");
          webrtc.createConnection(msg.peerId, false);
        }
      }
      webrtc.handleSignal(msg.peerId, signalData);
    });

    signalingClient.on("room-full", () => {
      store.setError("Room is full (max 20 peers)");
    });

    signalingClient.on("room-joined", (msg: SignalMessage) => {
      const existingPeers = (msg.data?.peers as string[]) || [];
      for (const pid of existingPeers.slice(0, MAX_CONNECTIONS)) {
        if (pid === myId) continue;
        store.addPeer(pid, `Peer-${pid.slice(0, 4)}`, "seeder");
        webrtc.createConnection(pid, true);
      }
    });

    signalingClient.joinRoom(roomCode, myId);
    await requestWakeLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isHost]);

  // ---- File management (host side) ----
  // Files auto-send to peers when added

  const addFiles = useCallback((files: File[]) => {
    const newEntries: { file: File; meta: FileMetadata }[] = files.map(f => ({
      file: f,
      meta: {
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        totalChunks: Math.ceil(f.size / CHUNK_SIZE),
      },
    }));

    // Add to shared files immediately
    for (const entry of newEntries) {
      sharedFilesRef.current.set(entry.meta.id, entry.file);
    }
    sharedMetaRef.current = [...sharedMetaRef.current, ...newEntries.map(e => e.meta)];

    // Update store — merge with existing files (preserve received files)
    const currentFiles = useSwarmStore.getState().files;
    const existingIds = new Set(currentFiles.map(f => f.id));
    const newMetas = newEntries.map(e => e.meta).filter(m => !existingIds.has(m.id));
    store.setFiles([...currentFiles, ...newMetas]);

    // Init file statuses
    for (const entry of newEntries) {
      store.initFileStatus(entry.meta.id, entry.meta.totalChunks, entry.meta.size, "pending");
    }

    // Auto-send if peers are connected
    const peerIds = webrtc.getConnectedPeerIds();
    if (peerIds.length > 0) {
      // Queue for sending
      sendQueueRef.current.push(...newEntries);
      processSendQueue();
    }

    return newEntries.map(e => e.meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processSendQueue]);

  const removeFile = useCallback((fileId: string) => {
    // Only allow removing unsent files
    const status = useSwarmStore.getState().fileStatuses[fileId];
    if (status && status.status !== "pending") return; // can't remove once sending

    sharedFilesRef.current.delete(fileId);
    sharedMetaRef.current = sharedMetaRef.current.filter(m => m.id !== fileId);
    store.setFiles([...sharedMetaRef.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Manual transfer (fallback, sends all unsent files) ----

  const startTransfer = useCallback(async () => {
    const unsent = sharedMetaRef.current.filter(m => {
      const status = useSwarmStore.getState().fileStatuses[m.id];
      return !status || status.status === "pending";
    });

    if (unsent.length === 0) return;

    for (const meta of unsent) {
      const file = sharedFilesRef.current.get(meta.id);
      if (file) {
        sendQueueRef.current.push({ file, meta });
      }
    }
    processSendQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processSendQueue]);

  // ---- Chat ----

  const sendTextMessage = useCallback(
    (text: string, displayName: string) => {
      myDisplayNameRef.current = displayName;
      const id = crypto.randomUUID();
      const timestamp = Date.now();

      store.addChatMessage({
        id,
        text,
        senderName: displayName,
        senderId: store.myPeerId,
        timestamp,
        isOwn: true,
      });

      webrtc.broadcast({
        type: "text-message",
        id,
        text,
        senderName: displayName,
        timestamp,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store]
  );

  // ---- Cleanup ----

  const leaveRoom = useCallback(() => {
    webrtc.disconnectAll();
    signalingClient.disconnect();
    releaseWakeLock();
    store.reset();
    sharedFilesRef.current.clear();
    sharedMetaRef.current = [];
    sendQueueRef.current = [];
    sendingRef.current = false;
    receivedChunksRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Speed tracking ----

  useEffect(() => {
    const interval = setInterval(() => {
      const s = useSwarmStore.getState();
      const now = Date.now();
      const elapsed = (now - speedTrackRef.current.lastTime) / 1000;
      if (elapsed > 0) {
        const speed = speedTrackRef.current.bytes / elapsed;
        const remaining = s.stats.totalBytes - s.stats.bytesTransferred;
        const eta = speed > 0 ? remaining / speed : 0;
        s.updateStats({ speed, eta });
        speedTrackRef.current = { bytes: 0, lastTime: now };
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ---- Individual file download ----

  const downloadFile = useCallback(async (fileId: string) => {
    const s = useSwarmStore.getState();
    const fileMeta = s.files.find(f => f.id === fileId);
    if (!fileMeta) return;

    const fileChunks = receivedChunksRef.current.get(fileId);
    if (!fileChunks || fileChunks.size < fileMeta.totalChunks) {
      console.warn(`[Swarm] can't download "${fileMeta.name}" — incomplete (${fileChunks?.size ?? 0}/${fileMeta.totalChunks})`);
      return;
    }

    const orderedChunks: ArrayBuffer[] = [];
    for (let i = 0; i < fileMeta.totalChunks; i++) {
      const chunk = fileChunks.get(i);
      if (!chunk) {
        console.error(`[Swarm] missing chunk ${i}`);
        return;
      }
      orderedChunks.push(chunk);
    }

    const blob = new Blob(orderedChunks, { type: fileMeta.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileMeta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[Swarm] ⬇️ downloaded "${fileMeta.name}"`);
  }, []);

  // ---- Download all complete files ----

  const downloadAllFiles = useCallback(async () => {
    const s = useSwarmStore.getState();
    for (const file of s.files) {
      const fs = s.fileStatuses[file.id];
      if (fs?.status === "complete") {
        await downloadFile(file.id);
      }
    }
  }, [downloadFile]);

  return {
    joinRoom,
    leaveRoom,
    startTransfer,
    sendTextMessage,
    addFiles,
    removeFile,
    downloadFile,
    downloadAllFiles,
  };
}
