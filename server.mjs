import { Server } from "socket.io";
import { createServer } from "http";

const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", rooms: rooms.size, uptime: process.uptime() }));
        return;
    }
    res.writeHead(404);
    res.end();
});

const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 5000,
});

// roomCode -> Map<peerId, socketId>
const rooms = new Map();
// socketId -> { roomCode, peerId }
const socketMap = new Map();

io.on("connection", (socket) => {
    console.log(`[connect] socket=${socket.id}`);

    socket.on("signal", (msg) => {
        if (!msg || !msg.type) return;

        switch (msg.type) {
            case "join-room": {
                const { roomCode, peerId } = msg;
                if (!roomCode || !peerId) return;

                console.log(`[join-room] peer=${peerId} room=${roomCode}`);

                if (!rooms.has(roomCode)) {
                    rooms.set(roomCode, new Map());
                }

                const room = rooms.get(roomCode);

                if (room.size >= 20) {
                    socket.emit("signal", { type: "room-full", roomCode, peerId });
                    return;
                }

                // Get existing peers BEFORE adding new one
                const existingPeers = Array.from(room.keys());
                room.set(peerId, socket.id);
                socketMap.set(socket.id, { roomCode, peerId });
                socket.join(roomCode);

                console.log(`[room-joined] peer=${peerId} existingPeers=[${existingPeers}]`);

                // Tell the joiner about existing peers
                socket.emit("signal", {
                    type: "room-joined",
                    roomCode,
                    peerId,
                    data: { peers: existingPeers },
                });

                // Tell existing peers about the new joiner
                socket.to(roomCode).emit("signal", {
                    type: "peer-joined",
                    roomCode,
                    peerId,
                });
                break;
            }

            case "signal": {
                // Relay WebRTC signaling data (offers, answers, ICE candidates)
                if (!msg.targetPeerId || !msg.roomCode) return;

                const room = rooms.get(msg.roomCode);
                if (!room) return;

                const targetSocketId = room.get(msg.targetPeerId);
                if (targetSocketId) {
                    console.log(`[relay] from=${msg.peerId} to=${msg.targetPeerId} signalType=${msg.data?.type || "candidate"}`);
                    io.to(targetSocketId).emit("signal", msg);
                } else {
                    console.log(`[relay-miss] to=${msg.targetPeerId} (not found in room)`);
                }
                break;
            }
        }
    });

    socket.on("disconnect", () => {
        const info = socketMap.get(socket.id);
        if (!info) return;

        const { roomCode, peerId } = info;
        console.log(`[disconnect] peer=${peerId} room=${roomCode}`);

        const room = rooms.get(roomCode);
        if (room) {
            room.delete(peerId);
            // Notify remaining peers
            socket.to(roomCode).emit("signal", {
                type: "peer-left",
                roomCode,
                peerId,
            });
            // Clean up empty rooms
            if (room.size === 0) {
                rooms.delete(roomCode);
                console.log(`[room-deleted] room=${roomCode}`);
            }
        }
        socketMap.delete(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`✅ DropLink signaling server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
});
