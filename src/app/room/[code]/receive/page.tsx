"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, ArrowLeft, MessageSquare, FileDown, FileUp,
  Send, File, Check, Loader2, Users, WifiHigh, Clock, Paperclip,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSwarm } from "@/hooks/useSwarm";
import { useSwarmStore } from "@/store/useSwarmStore";
import { TextShare } from "@/components/transfer/TextShare";
import { Header } from "@/components/layout/Header";
import { toast } from "sonner";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bps: number) {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

export default function ReceivePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const store = useSwarmStore();
  const swarm = useSwarm(code, false);

  const joinedRoomRef = useRef(false);
  const [displayName, setDisplayName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [chatText, setChatText] = useState("");
  const [downloading, setDownloading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    swarm.addFiles(acceptedFiles);
    toast.success(`${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} added — sending to peers`);
  }, [swarm]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
    noKeyboard: false,
  });

  useEffect(() => {
    if (nameSet && !joinedRoomRef.current) {
      swarm.joinRoom();
      joinedRoomRef.current = true;
    }
    return () => {
      if (joinedRoomRef.current) {
        swarm.leaveRoom();
        joinedRoomRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSet]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [store.chatMessages]);

  useEffect(() => {
    if (store.transferState === "complete") {
      toast.success("Transfer complete! Files ready to download.");
    }
  }, [store.transferState]);

  useEffect(() => {
    if (store.chatMessages.length > 0) {
      const last = store.chatMessages[store.chatMessages.length - 1];
      if (!last.isOwn) {
        toast.info(`${last.senderName}: ${last.text.slice(0, 50)}${last.text.length > 50 ? "…" : ""}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.chatMessages.length]);

  const handleDownload = async (fileId?: string) => {
    setDownloading(true);
    try {
      if (fileId) {
        await swarm.downloadFile(fileId);
        toast.success("Download started!");
      } else {
        await swarm.downloadAllFiles();
        toast.success("All downloads started!");
      }
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleSendText = () => {
    const trimmed = chatText.trim();
    if (!trimmed) return;
    swarm.sendTextMessage(trimmed, displayName || `Peer-${store.myPeerId.slice(0, 4)}`);
    setChatText("");
  };

  const peerCount = Object.keys(store.peers).length;
  const activePeers = Object.values(store.peers).filter((p) => p.status === "active").length;
  const transferProgress =
    store.stats.totalChunks > 0
      ? Math.round((store.stats.chunksCompleted / store.stats.totalChunks) * 100)
      : 0;

  const isTransferActive = store.transferState === "active";
  const isTransferComplete = store.transferState === "complete";

  if (!nameSet) {
    return (
      <div className="relative min-h-screen flex flex-col bg-[#0a0a0a]">
        <div className="fixed inset-0 bg-dot-grid pointer-events-none" />
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/[0.03] rounded-full blur-[120px]" />
        </div>
        <Header />
        <main className="relative flex-1 flex items-center justify-center px-4 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm"
          >
            <Card className="border-white/[0.08] bg-white/[0.02] shadow-2xl shadow-black/30 gap-0 py-0 overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400" />
              <CardHeader className="px-8 pt-8 pb-0">
                <div className="mx-auto mb-5 relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl bg-emerald-500/15 blur-lg" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.1]">
                    <Download className="h-8 w-8 text-emerald-400" strokeWidth={1.5} />
                  </div>
                </div>
                <h2 className="text-center text-xl font-bold text-white">Joining room</h2>
                <p className="text-center text-sm text-neutral-500 mt-1">
                  Code:{" "}
                  <span className="font-mono text-cyan-400 font-bold tracking-widest">{code}</span>
                </p>
                <p className="text-center text-xs text-neutral-600 mt-1">Enter a name so others can identify you</p>
              </CardHeader>
              <CardContent className="px-8 pb-8 pt-6">
                <Input
                  placeholder="Display name (optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setNameSet(true)}
                  className="mb-4 h-12 text-center bg-white/[0.04] border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-white"
                  maxLength={24}
                  autoFocus
                />
                <Button
                  onClick={() => setNameSet(true)}
                  className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Join room
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0a0a0a]">
      <div className="fixed inset-0 bg-dot-grid pointer-events-none" />
      <Header />

      <main className="relative flex-1 pt-20 pb-8 px-4">
        <div className="mx-auto max-w-5xl">

          {/* Top bar */}
          <div className="flex items-center gap-3 mb-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { swarm.leaveRoom(); router.push("/"); }}
                  className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                  Leave
                </button>
              </TooltipTrigger>
              <TooltipContent>Leave room</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 bg-white/[0.08]" />

            <span className="font-mono text-sm text-neutral-500">
              Room <span className="text-cyan-400 font-bold tracking-widest">{code}</span>
            </span>

            <div className="ml-auto">
              <AnimatePresence mode="wait">
                {activePeers > 0 ? (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-400">
                      {activePeers} peer{activePeers > 1 ? "s" : ""} connected
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1.5"
                  >
                    <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
                    <span className="text-xs font-medium text-amber-400">Connecting…</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Left sidebar */}
            <div className="lg:col-span-1 space-y-4">

              {/* Peers */}
              <Card className="border-white/[0.08] bg-white/[0.02] shadow-xl shadow-black/20 gap-0 py-0 overflow-hidden">
                <CardHeader className="px-5 pt-5 pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-neutral-500" />
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Room</p>
                    </div>
                    <Badge className="bg-white/[0.06] text-neutral-400 border-white/[0.08] text-[10px] h-5 min-w-5">
                      {peerCount}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-3">
                  {peerCount === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-5 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.03]">
                        <WifiHigh className="h-4 w-4 text-neutral-600" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
                        <p className="text-xs text-amber-400">Waiting for host…</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.values(store.peers).map((peer) => (
                        <motion.div
                          key={peer.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                        >
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${peer.status === "active" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" :
                            peer.status === "connecting" ? "bg-amber-400 animate-pulse" : "bg-neutral-600"
                            }`} />
                          <span className="text-sm text-neutral-300 truncate flex-1">{peer.displayName}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] border-0 px-1.5 py-0 h-4 capitalize ${peer.role === "seeder" ? "bg-cyan-500/10 text-cyan-400" : "bg-white/[0.04] text-neutral-500"
                              }`}
                          >
                            {peer.role}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Transfer status */}
              <AnimatePresence>
                {(isTransferActive || isTransferComplete || store.files.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                  >
                    <Card className="border-white/[0.08] bg-white/[0.02] shadow-xl shadow-black/20 gap-0 py-0 overflow-hidden">
                      {isTransferActive && (
                        <div
                          className="h-0.5 bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                          style={{ width: `${transferProgress}%` }}
                        />
                      )}
                      {isTransferComplete && (
                        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                      )}
                      <CardHeader className="px-5 pt-5 pb-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Transfer</p>
                          {isTransferActive && (
                            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] gap-1">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Receiving
                            </Badge>
                          )}
                          {isTransferComplete && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                              <Check className="h-2.5 w-2.5" />
                              Done
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-3 space-y-3">
                        {store.files.map((f) => {
                          const fs = store.fileStatuses[f.id];
                          const progress = fs && fs.totalChunks > 0 ? Math.round((fs.chunksReceived / fs.totalChunks) * 100) : 0;
                          const duration = fs?.completedAt && fs?.startedAt ? ((fs.completedAt - fs.startedAt) / 1000) : null;
                          return (
                            <div key={f.id} className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                                  {fs?.status === "complete" ? (
                                    <Check className="h-4 w-4 text-emerald-400" />
                                  ) : fs?.status === "receiving" ? (
                                    <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                                  ) : (
                                    <File className="h-4 w-4 text-neutral-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-neutral-200 truncate">{f.name}</p>
                                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                                    <span>{formatBytes(f.size)}</span>
                                    {fs?.status === "receiving" && <span className="text-cyan-400">{progress}%</span>}
                                    {fs?.status === "complete" && duration !== null && (
                                      <span className="flex items-center gap-1 text-emerald-500">
                                        <Clock className="h-3 w-3" />
                                        {duration < 1 ? '<1s' : `${duration.toFixed(1)}s`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {fs?.status === "complete" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleDownload(f.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors flex-shrink-0"
                                      >
                                        <Download className="h-3.5 w-3.5 text-emerald-400" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Download</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              {fs?.status === "receiving" && (
                                <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden ml-12">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {isTransferActive && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-400 font-medium">{transferProgress}%</span>
                              <span className="text-neutral-500">{formatSpeed(store.stats.speed)}</span>
                            </div>
                            <Progress
                              value={transferProgress}
                              className="h-2 bg-white/[0.06]"
                            />
                          </div>
                        )}

                        {isTransferComplete && (
                          <Button
                            onClick={() => handleDownload()}
                            disabled={downloading}
                            className="w-full h-10 bg-white text-black font-semibold rounded-xl text-sm hover:bg-neutral-200 transition-all"
                          >
                            {downloading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4 mr-2" />
                            )}
                            {downloading ? "Preparing…" : "Download all"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Main panel */}
            <div className="lg:col-span-2">
              <Card className="border-white/[0.08] bg-white/[0.02] shadow-xl shadow-black/20 gap-0 py-0 overflow-hidden h-full">
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-500/20 to-cyan-500/10" />

                <Tabs defaultValue="files" className="flex flex-col h-full gap-0">
                  <div className="px-5 pt-4">
                    <TabsList className="w-full bg-white/[0.03] border border-white/[0.06] h-10 p-1 rounded-xl">
                      <TabsTrigger
                        value="files"
                        className="flex-1 data-[state=active]:bg-white/[0.08] data-[state=active]:text-emerald-400 data-[state=active]:shadow-none rounded-lg text-neutral-500 text-sm transition-all"
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1.5" />
                        Files
                        {store.files.length > 0 && (
                          <Badge className="ml-1.5 bg-white/[0.06] text-neutral-300 border-0 text-[10px] h-4 min-w-4 px-1">
                            {store.files.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="chat"
                        className="flex-1 data-[state=active]:bg-white/[0.08] data-[state=active]:text-emerald-400 data-[state=active]:shadow-none rounded-lg text-neutral-500 text-sm transition-all"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                        Text
                        {store.chatMessages.length > 0 && (
                          <Badge className="ml-1.5 bg-cyan-500/20 text-cyan-400 border-0 text-[10px] h-4 min-w-4 px-1">
                            {store.chatMessages.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Files tab */}
                  <TabsContent value="files" className="flex-1 p-5 pt-4 mt-0">
                    <div className="min-h-[300px] flex flex-col gap-4">
                      {/* Send files drop zone */}
                      <div
                        {...getRootProps()}
                        className={`relative flex items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all cursor-pointer p-4 group ${isDragActive
                          ? "border-emerald-500/70 bg-emerald-500/5 scale-[1.01]"
                          : "border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.03]"
                          }`}
                      >
                        <input {...getInputProps()} />
                        <motion.div
                          animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] group-hover:border-white/[0.12] transition-colors flex-shrink-0"
                        >
                          <Paperclip className="h-4 w-4 text-neutral-400 group-hover:text-neutral-300 transition-colors" />
                        </motion.div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-neutral-300">
                            {isDragActive ? "Drop to send files" : "Send files back"}
                          </p>
                          <p className="text-xs text-neutral-600">
                            or <span className="text-neutral-400 underline underline-offset-2">click to browse</span> — files will be sent to the host
                          </p>
                        </div>
                      </div>

                      {store.files.length === 0 && !isTransferActive ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex-1 flex flex-col items-center justify-center gap-4 py-10 text-center"
                        >
                          <div className="relative flex h-16 w-16 items-center justify-center">
                            <div className="absolute inset-0 rounded-2xl bg-white/[0.03] blur-sm" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02]">
                              <FileDown className="h-7 w-7 text-neutral-600" />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-400">Waiting for files from host</p>
                            <p className="text-xs text-neutral-600 mt-1">Files will appear here when the host sends them</p>
                          </div>
                          {activePeers === 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400/80">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Connecting to host…
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <div className="space-y-3">
                          {store.files.map((f, i) => {
                            const fs = store.fileStatuses[f.id];
                            const progress = fs && fs.totalChunks > 0 ? Math.round((fs.chunksReceived / fs.totalChunks) * 100) : 0;
                            const duration = fs?.completedAt && fs?.startedAt ? ((fs.completedAt - fs.startedAt) / 1000) : null;
                            const isFileComplete = fs?.status === "complete";
                            return (
                              <motion.div
                                key={f.id}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                                    {isFileComplete ? (
                                      <Check className="h-5 w-5 text-emerald-400" />
                                    ) : fs?.status === "receiving" ? (
                                      <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
                                    ) : (
                                      <File className="h-5 w-5 text-neutral-500" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-neutral-200 truncate font-medium">{f.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                                      <span>{formatBytes(f.size)}</span>
                                      {fs?.status === "receiving" && (
                                        <span className="text-cyan-400 font-medium">{progress}%</span>
                                      )}
                                      {isFileComplete && duration !== null && (
                                        <span className="flex items-center gap-1 text-emerald-500">
                                          <Clock className="h-3 w-3" />
                                          {duration < 1 ? '<1s' : `${duration.toFixed(1)}s`}
                                        </span>
                                      )}
                                      {isFileComplete && (
                                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-1.5 py-0">
                                          Complete
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {isFileComplete && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDownload(f.id)}
                                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 px-2.5 rounded-lg text-xs gap-1.5"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Save
                                    </Button>
                                  )}
                                </div>
                                {fs?.status === "receiving" && (
                                  <div className="mt-2 h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}

                          {isTransferActive && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="space-y-2"
                            >
                              <div className="flex justify-between text-xs">
                                <span className="text-neutral-400">Overall: <span className="font-semibold text-neutral-300">{transferProgress}%</span></span>
                                <span className="text-neutral-500 font-mono">{formatSpeed(store.stats.speed)}</span>
                              </div>
                              <Progress value={transferProgress} className="h-2 bg-white/[0.06]" />
                            </motion.div>
                          )}

                          {isTransferComplete && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-3"
                            >
                              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                </div>
                                <div>
                                  <p className="text-sm text-emerald-400 font-semibold">Transfer complete!</p>
                                  <p className="text-xs text-emerald-500/70">All {store.files.length} file{store.files.length > 1 ? 's' : ''} ready</p>
                                </div>
                              </div>
                              <Button
                                onClick={() => handleDownload()}
                                disabled={downloading}
                                className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
                              >
                                {downloading ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <FileDown className="h-4 w-4 mr-2" />
                                )}
                                {downloading ? "Preparing download…" : `Download all ${store.files.length} file${store.files.length > 1 ? 's' : ''}`}
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Text Share tab */}
                  <TabsContent value="chat" className="flex-1 px-5 pb-5 pt-0 mt-0 flex flex-col gap-3">
                    <TextShare
                      messages={store.chatMessages}
                      onSend={(text) => swarm.sendTextMessage(text, displayName || `Peer-${store.myPeerId.slice(0, 4)}`)}
                      disabled={activePeers === 0}
                      disabledText="Waiting for connection…"
                      accentColor="emerald"
                    />
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
