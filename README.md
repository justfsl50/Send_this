# THIS — Peer-to-Peer File & Text Sharing

**THIS** is a browser-based, peer-to-peer file and text sharing application. No accounts, no cloud storage, no file size limits — files transfer directly between browsers using WebRTC.

🔗 **Live:** [send-this.vercel.app](https://send-this.vercel.app)

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Direct P2P Transfer** | Files go browser → browser via WebRTC data channels. No server upload. |
| **Room-Based Sharing** | Create a 6-character room code. Share it or scan a QR code to join. |
| **Bidirectional File Sharing** | Both host and receiver can send files to each other. |
| **Real-Time Text Chat** | Send text messages alongside file transfers in the same room. |
| **No Account Required** | No signup, no login. Just create a room and share. |
| **No File Size Limit** | Files are chunked and streamed — send anything. |
| **P2P Encrypted** | WebRTC encrypts data in transit automatically (DTLS/SRTP). |
| **Wake Lock** | Keeps the screen on during transfers on supported devices. |
| **QR Code Sharing** | Generate a QR code for the room's receive URL for quick mobile access. |
| **TURN Relay** | Falls back to TURN relay servers for peers behind strict NATs/firewalls. |
| **Auto-Retry** | Automatically retries failed connections up to 3 times with backoff. |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│              (send-this.vercel.app)                     │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
│  │ Landing  │   │  Sender  │   │    Receiver       │    │
│  │  Page    │   │  /room/X │   │  /room/X/receive  │    │
│  └──────────┘   └────┬─────┘   └────────┬──────────┘    │
│                      │                   │               │
│              ┌───────┴───────────────────┘               │
│              │     useSwarm Hook                         │
│              │  (manages all P2P logic)                  │
│              └───────┬───────────────────┐               │
│              ┌───────┴─────┐   ┌─────────┴──────┐       │
│              │  useWebRTC  │   │ Signaling      │       │
│              │  (simple-   │   │ Client         │       │
│              │   peer)     │   │ (socket.io)    │       │
│              └──────┬──────┘   └────────┬───────┘       │
└─────────────┼───────┼──────────────────┼───────────────┘
              │ TURN relay               │ WebSocket
    ┌─────────┴──────────┐  ┌────────────┴─────────────┐
    │  Metered TURN      │  │   Signaling Server       │
    │  (global.relay.    │  │   (Railway)              │
    │   metered.ca)      │  │                          │
    │                    │  │  • Room management       │
    │  • NAT traversal   │  │  • Peer discovery        │
    │  • Relay fallback  │  │  • WebRTC signal relay   │
    └────────────────────┘  └──────────────────────────┘
```

### How It Works

1. **Host creates a room** → Generates a 6-character room code
2. **Host joins signaling server** → Registers on the WebSocket server with a unique peer ID
3. **Receiver opens the link** → `/room/CODE/receive` → Joins the same signaling room
4. **WebRTC handshake** → Signaling server relays SDP offers/answers and ICE candidates
5. **Direct data channel opens** → Peers are now connected browser-to-browser
6. **Files stream as chunks** → Files are sliced into 64KB chunks and sent over the data channel
7. **Receiver reassembles** → Chunks are collected in memory, then downloaded as a Blob

> **Important:** The signaling server is only used for peer discovery and WebRTC negotiation. Once the P2P connection is established, **all file/text data flows directly between browsers** — the server never sees the file content.

---

## 📁 Project Structure

```
├── server.mjs                  # Local signaling server (for development)
├── server/                     # Standalone signaling server (Railway deployment)
│   ├── index.mjs
│   └── package.json
├── .env.production             # Production environment variables
├── package.json
├── next.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (fonts, metadata, global styles)
│   │   ├── page.tsx            # Landing page
│   │   ├── globals.css         # Global CSS (Tailwind, dot grid, animations)
│   │   └── room/
│   │       └── [code]/
│   │           ├── page.tsx    # Sender/Host room page
│   │           └── receive/
│   │               └── page.tsx # Receiver room page
│   ├── hooks/
│   │   ├── useSwarm.ts         # Core P2P orchestration hook
│   │   └── useWebRTC.ts        # WebRTC connection management hook
│   ├── lib/
│   │   ├── socket.ts           # SignalingClient (Socket.IO wrapper)
│   │   ├── webrtc.ts           # WebRTC peer creation + TURN config
│   │   ├── mesh.ts             # Room/peer ID generation, connection helpers
│   │   ├── wakeLock.ts         # Screen Wake Lock API wrapper
│   │   └── utils.ts            # Tailwind cn() utility
│   ├── store/
│   │   └── useSwarmStore.ts    # Zustand store (peers, files, transfer state)
│   ├── types/
│   │   ├── messages.ts         # SignalMessage type definitions
│   │   ├── mesh.ts             # PeerInfo, FileMetadata, ChatMessage types
│   │   └── transfer.ts         # Transfer constants (CHUNK_SIZE, MAX_CONNECTIONS)
│   └── components/
│       ├── layout/
│       │   ├── Header.tsx      # Top navigation bar
│       │   └── Footer.tsx      # Landing page footer
│       ├── transfer/
│       │   └── TextShare.tsx   # Real-time text messaging component
│       └── ui/                 # shadcn/ui component library
└── public/
    └── favicon.ico
```

---

## 🔑 Core Modules

### `useSwarm.ts` — The Main Orchestrator

Manages room joining/leaving, peer handshakes, file sharing (adding, chunking, sending, receiving, reassembling), text messaging, transfer tracking, and late joiner support. Includes auto-retry logic for failed connections (up to 3 attempts with exponential backoff).

| Function | Description |
|---|---|
| `joinRoom()` | Connect to signaling server and join the room |
| `leaveRoom()` | Disconnect from all peers and clean up |
| `addFiles(files)` | Add files to share — auto-sends if peers are connected |
| `removeFile(fileId)` | Remove a pending (unsent) file |
| `sendTextMessage(text, name)` | Broadcast a text message to all peers |
| `downloadFile(fileId)` | Download a completed received file |
| `downloadAllFiles()` | Download all completed received files |
| `startTransfer()` | Manually trigger sending of pending files |

### `webrtc.ts` — WebRTC + TURN Configuration

Creates `simple-peer` connections with reliable, ordered data channels. Configured with Google STUN servers and Metered TURN relay servers for production NAT traversal.

### `socket.ts` — Signaling Client

Wraps Socket.IO for signaling: connects to the WebSocket server, sends `join-room` and `signal` messages, dispatches `room-joined`, `peer-joined`, `peer-left`, and `signal` events.

### `server/index.mjs` — Signaling Server (Railway)

Lightweight Node.js WebSocket server (Socket.IO):
- **Room management**: Max 20 peers per room
- **Signal relay**: Forward WebRTC offers/answers/ICE candidates
- **Health check**: `GET /health` endpoint
- **No file data** — purely signaling

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Language** | TypeScript |
| **UI Components** | shadcn/ui (Radix UI primitives) |
| **Styling** | Tailwind CSS v4 |
| **Animations** | Framer Motion |
| **State** | Zustand |
| **WebRTC** | simple-peer |
| **TURN Relay** | Metered (global.relay.metered.ca) |
| **Signaling** | Socket.IO (client + server) |
| **Icons** | Lucide React |
| **QR Codes** | qrcode.react |
| **Hosting** | Vercel (frontend) + Railway (signaling server) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Local Development

```bash
# Install dependencies
npm install

# Start the signaling server (port 3001)
node server.mjs

# Start the Next.js dev server (port 3000) — in a separate terminal
npm run dev
```

Open `http://localhost:3000`, create a room, and share the link!

### Deployment

**Frontend** is deployed to [Vercel](https://vercel.com). **Signaling server** is deployed to [Railway](https://railway.app) from the `server/` directory.

```bash
# Deploy frontend
vercel --prod

# Deploy signaling server
cd server
railway up --detach
```

Set `NEXT_PUBLIC_SIGNAL_SERVER` in `.env.production` to your Railway signaling server URL.

---

## 🔒 Security Model

- **DTLS/SRTP encryption**: WebRTC encrypts all data channel traffic automatically
- **No server-side storage**: Files never touch the server — direct browser-to-browser
- **Ephemeral rooms**: Rooms are deleted when all peers disconnect
- **No accounts/passwords**: Nothing to leak — fully stateless
- **TURN relay**: Uses Metered TURN servers for NAT traversal behind firewalls

---

## 📡 Data Flow

```
Host                    Signaling Server              Receiver
  │                           │                           │
  │──── join-room ───────────▶│                           │
  │◀─── room-joined ─────────│                           │
  │                           │◀──── join-room ───────────│
  │                           │──── room-joined ─────────▶│
  │◀─── peer-joined ─────────│                           │
  │                           │                           │
  │──── WebRTC offer ────────▶│──── relay offer ─────────▶│
  │◀─── relay answer ────────│◀─── WebRTC answer ────────│
  │◀───── ICE candidates ────▶│◀──── ICE candidates ─────▶│
  │                           │                           │
  │═══════ P2P Data Channel Established ═════════════════│
  │                           │                           │
  │──── handshake ───────────────────────────────────────▶│
  │◀──── handshake ──────────────────────────────────────│
  │──── file-offer ──────────────────────────────────────▶│
  │──── chunk[0..N] ─────────────────────────────────────▶│
  │──── file-complete ───────────────────────────────────▶│
  │                                                       │
  │                    (Bidirectional!)                    │
  │◀──── file-offer ─────────────────────────────────────│
  │◀──── chunks ─────────────────────────────────────────│
```

### Chunk Format

Files are split into **64KB chunks** sent as binary data. Each chunk is framed with a metadata header:

```
[4 bytes: fileId length][fileId string][4 bytes: chunkIndex][4 bytes: totalChunks][chunk data]
```

Control messages (handshake, file-offer, text-message) are sent as JSON strings.

---

## 📋 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Signaling server port |
| `NEXT_PUBLIC_SIGNAL_SERVER` | `ws://localhost:3001` | Signal server URL |

---

## 📄 License

MIT License
