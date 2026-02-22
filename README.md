# THIS — Peer-to-Peer File & Text Sharing

**THIS** is a browser-based, peer-to-peer file and text sharing application. No accounts, no cloud storage, no file size limits — files transfer directly between browsers using WebRTC.

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

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│                   (localhost:3000)                       │
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
│              └─────────────┘   └────────┬───────┘       │
└─────────────────────────────────────────┼───────────────┘
                                          │ WebSocket
                            ┌─────────────┴────────────┐
                            │   Signaling Server       │
                            │   server.mjs (:3001)     │
                            │                          │
                            │  • Room management       │
                            │  • Peer discovery        │
                            │  • WebRTC signal relay   │
                            └──────────────────────────┘
```

### How It Works

1. **Host creates a room** → Generates a 6-character room code
2. **Host joins signaling server** → Registers on the WebSocket server with a unique peer ID
3. **Receiver opens the link** → `/room/CODE/receive` → Joins the same signaling room
4. **WebRTC handshake** → Signaling server relays SDP offers/answers and ICE candidates
5. **Direct data channel opens** → Peers are now connected browser-to-browser
6. **Files stream as chunks** → Files are sliced into 64KB chunks and sent over the data channel
7. **Receiver reassembles** → Chunks are collected in memory, then downloaded as a Blob

> **Important:** The signaling server (`server.mjs`) is only used for peer discovery and WebRTC negotiation. Once the P2P connection is established, **all file/text data flows directly between browsers** — the server never sees the file content.

---

## 📁 Project Structure

```
droplink-frontend/
├── server.mjs                  # WebSocket signaling server (Socket.IO)
├── package.json                # Dependencies and scripts
├── next.config.ts              # Next.js configuration
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
│   │   ├── webrtc.ts           # WebRTC peer creation (simple-peer wrapper)
│   │   ├── mesh.ts             # Room/peer ID generation, connection helpers
│   │   ├── wakeLock.ts         # Screen Wake Lock API wrapper
│   │   └── utils.ts            # Tailwind `cn()` utility
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
│           ├── button.tsx
│           ├── card.tsx
│           ├── tabs.tsx
│           ├── badge.tsx
│           ├── progress.tsx
│           ├── tooltip.tsx
│           ├── scroll-area.tsx
│           └── ... (other shadcn components)
└── public/
    └── favicon.ico
```

---

## 🔑 Core Modules Explained

### `useSwarm.ts` — The Main Orchestrator

This is the brain of the app. It manages:

- **Room joining/leaving** via the signaling server
- **Peer handshake** (exchanging display names, host/receiver roles)
- **File sharing** (adding files, chunking, sending, receiving, reassembling)
- **Text messaging** (broadcast chat messages to all peers)
- **Transfer tracking** (per-file progress, speed, ETA)
- **Late joiner support** (new peers receive all previously shared files)

**Key functions exposed:**
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

### `useWebRTC.ts` — Connection Manager

Manages multiple WebRTC peer connections:
- Creates and tracks `simple-peer` instances per remote peer
- Handles data channel message framing (control JSON vs binary chunks)
- Provides `broadcast()`, `sendMessage()`, `sendChunk()` APIs
- Manages connect/disconnect/error lifecycle events

### `socket.ts` — Signaling Client

Wraps Socket.IO for signaling:
- Connects to the WebSocket signaling server
- Sends `join-room` and `signal` (WebRTC relay) messages
- Dispatches events: `room-joined`, `peer-joined`, `peer-left`, `signal`

### `server.mjs` — Signaling Server

A lightweight Node.js WebSocket server (Socket.IO):
- **Room management**: Create/join/leave rooms (max 20 peers per room)
- **Signal relay**: Forward WebRTC offers/answers/ICE candidates between peers
- **Peer tracking**: Map peer IDs to socket IDs for targeted messaging
- **Health check**: `GET /health` endpoint for monitoring
- **No file data touches the server** — purely signaling

### `useSwarmStore.ts` — State Management

Zustand store holding all runtime state:
- Room info (code, peer ID, host status)
- Connected peers (name, role, status)
- File list and per-file transfer status (direction, progress, speed)
- Chat messages
- Transfer stats (bytes, speed, ETA)

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
| **Signaling** | Socket.IO (client + server) |
| **Icons** | Lucide React |
| **QR Codes** | qrcode.react |
| **File Handling** | react-dropzone |
| **Toasts** | Sonner |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- npm / bun

### Installation

```bash
# Install dependencies
npm install

# Start the signaling server (port 3001)
node server.mjs

# Start the Next.js dev server (port 3000) — in a separate terminal
npm run dev
```

### Usage

1. Open `http://localhost:3000`
2. Click **"Get Started"** or **"New Room"**
3. Enter a display name → you're now the **Host**
4. Share the room code or QR code with others
5. The receiver opens `http://localhost:3000/room/CODE/receive`
6. Once connected, drag & drop files or type text messages
7. Files transfer directly — both sides can send and receive

### Production Build

```bash
npm run build
npm start
```

---

## 🔒 Security Model

- **DTLS/SRTP encryption**: WebRTC encrypts all data channel traffic automatically
- **No server-side storage**: Files never touch the server — direct browser-to-browser
- **Ephemeral rooms**: Rooms are deleted when all peers disconnect
- **No accounts/passwords**: Nothing to leak — fully stateless
- **STUN-only by default**: Using Google STUN servers for NAT traversal (no TURN relay)

> **Note:** Without a TURN server, connections may fail behind strict symmetric NATs or corporate firewalls. For production, consider adding a TURN server to the ICE configuration in `webrtc.ts`.

---

## 📡 Data Flow

### File Transfer Sequence

```
Host                    Signaling Server              Receiver
  │                           │                           │
  │──── join-room ───────────▶│                           │
  │◀─── room-joined ─────────│                           │
  │                           │                           │
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
  │                           │                           │
  │──── file-offer ──────────────────────────────────────▶│
  │──── chunk[0] ────────────────────────────────────────▶│
  │──── chunk[1] ────────────────────────────────────────▶│
  │──── ...                                               │
  │──── chunk[N] ────────────────────────────────────────▶│
  │──── file-complete ───────────────────────────────────▶│
  │                                                       │
  │                    (Receiver can also send back!)      │
  │◀──── file-offer ─────────────────────────────────────│
  │◀──── chunks ─────────────────────────────────────────│
```

### Chunk Format

Files are split into **64KB chunks** and sent as binary data over the WebRTC data channel. Each chunk is framed with a metadata header:

```
[4 bytes: fileId length][fileId string][4 bytes: chunkIndex][4 bytes: totalChunks][chunk data]
```

Control messages (handshake, file-offer, text-message, etc.) are sent as JSON strings.

---

## 🎨 Design Philosophy

- **Premium dark aesthetic**: True black (`#0a0a0a`) with subtle dot grid background
- **Glassmorphism**: Transparent cards with soft borders (`bg-white/[0.02]`)
- **Micro-animations**: Framer Motion for scroll reveals and UI transitions
- **Responsive typography**: Giant "Send This" brand text using `clamp()` for fluid scaling
- **Monochrome branding**: Clean white-on-dark with emerald/cyan accents for status indicators

---

## 📋 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Signaling server port |
| `NEXT_PUBLIC_SIGNAL_SERVER` | `http://localhost:3001` | Signal server URL (set in `useSwarm.ts`) |

---

## 📄 License

Private project. All rights reserved.
