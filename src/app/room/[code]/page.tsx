"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Users, Copy, Check, QrCode, X, Send, FileUp,
  ArrowLeft, Paperclip, MessageSquare, File, Link2,
  WifiHigh, Clock, Loader2, Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TextShare } from "@/components/transfer/TextShare";
import { useSwarm } from "@/hooks/useSwarm";
import { useSwarmStore } from "@/store/useSwarmStore";
import { Header } from "@/components/layout/Header";
import { toast } from "sonner";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const store = useSwarmStore();

  const [displayName, setDisplayName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const joinedRoomRef = useRef(false);

  const swarm = useSwarm(code, true);

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

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${code}/receive`
    : "";

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const activePeerCount = Object.values(store.peers).filter(p => p.status === "active").length;
    swarm.addFiles(acceptedFiles);
    if (activePeerCount > 0) {
      toast.success(`${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} added — sending automatically`);
    } else {
      toast.info(`${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} queued — will send when peers connect`);
    }
  }, [swarm, store.peers]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
    noKeyboard: false,
  });

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success("Room code copied!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendText = () => {
    const trimmed = chatText.trim();
    if (!trimmed) return;
    swarm.sendTextMessage(trimmed, displayName);
    setChatText("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.chatMessages.length]);

  const peerCount = Object.keys(store.peers).length;
  const activePeers = Object.values(store.peers).filter((p) => p.status === "active").length;

  if (!nameSet) {
    return (
      <div className="relative min-h-screen flex flex-col bg-[#0a0a0a]">
        <div className="fixed inset-0 bg-dot-grid pointer-events-none" />
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-500/[0.03] rounded-full blur-[120px]" />
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
              <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400" />
              <CardHeader className="px-8 pt-8 pb-0">
                <div className="mx-auto mb-5 relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl bg-cyan-500/15 blur-lg" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.1]">
                    <Zap className="h-8 w-8 text-cyan-400" strokeWidth={1.5} />
                  </div>
                </div>
                <CardTitle className="text-center text-xl text-white">Create your room</CardTitle>
                <p className="text-center text-sm text-neutral-500 mt-1">What should others see as your name?</p>
              </CardHeader>
              <CardContent className="px-8 pb-8 pt-6">
                <Input
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && displayName.trim() && setNameSet(true)}
                  className="mb-4 h-12 text-center bg-white/[0.04] border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-white"
                  maxLength={24}
                  autoFocus
                />
                <Button
                  onClick={() => setNameSet(true)}
                  disabled={!displayName.trim()}
                  className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  Enter room
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
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
              <TooltipContent>Leave room and go home</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 bg-white/[0.08]" />

            <span className="font-mono text-sm text-neutral-500">
              Room <span className="text-cyan-400 font-bold tracking-widest">{code}</span>
            </span>

            <div className="ml-auto flex items-center gap-2">
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
                    key="waiting"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1.5"
                  >
                    <Clock className="h-3 w-3 text-neutral-500" />
                    <span className="text-xs font-medium text-neutral-500">Waiting for peers…</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Left sidebar */}
            <div className="lg:col-span-1 space-y-4">

              {/* Room code card */}
              <Card className="border-white/[0.08] bg-white/[0.02] shadow-xl shadow-black/20 gap-0 py-0 overflow-hidden">
                <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500/50 via-cyan-400/30 to-transparent" />
                <CardHeader className="px-5 pt-5 pb-0">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Room Code</p>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-4">
                  <div className="flex items-center justify-center gap-1 mb-4">
                    {code.split("").map((char, i) => (
                      <motion.span
                        key={i}
                        initial={{ y: 12, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.05, type: "spring", stiffness: 400 }}
                        className="flex h-10 w-8 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/8 font-mono text-base font-bold text-cyan-300"
                      >
                        {char}
                      </motion.span>
                    ))}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={copyCode}
                          className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all hover:bg-white/[0.06]"
                        >
                          <AnimatePresence mode="wait">
                            {copiedCode ? (
                              <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Check className="h-4 w-4 text-emerald-400" />
                              </motion.div>
                            ) : (
                              <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Copy className="h-4 w-4" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Copy room code</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyLink}
                          className="w-full border-white/[0.08] text-neutral-300 hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white text-xs rounded-lg transition-all"
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                          {copiedLink ? "Copied!" : "Copy invite link"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy shareable link</TooltipContent>
                    </Tooltip>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQR(!showQR)}
                      className="w-full border-white/[0.08] text-neutral-300 hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white text-xs rounded-lg transition-all"
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1.5" />
                      {showQR ? "Hide QR code" : "Show QR code"}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showQR && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="flex justify-center overflow-hidden"
                      >
                        <div className="rounded-xl border border-white/[0.1] bg-white p-3 shadow-lg shadow-black/20">
                          <QRCodeSVG value={shareUrl} size={152} bgColor="#ffffff" fgColor="#0a0a0a" level="M" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Peers card */}
              <Card className="border-white/[0.08] bg-white/[0.02] shadow-xl shadow-black/20 gap-0 py-0 overflow-hidden">
                <CardHeader className="px-5 pt-5 pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-neutral-500" />
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Peers</p>
                    </div>
                    <Badge
                      className="bg-white/[0.06] text-neutral-400 border-white/[0.08] text-[10px] h-5 min-w-5 flex items-center justify-center"
                    >
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
                      <p className="text-xs text-neutral-600">No one joined yet</p>
                      <p className="text-[10px] text-neutral-700">Share the code or link above</p>
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
                            className={`text-[10px] border-0 px-1.5 py-0 h-4 ${peer.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                              peer.status === "connecting" ? "bg-amber-500/10 text-amber-400" :
                                "bg-white/[0.04] text-neutral-500"
                              }`}
                          >
                            {peer.status}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main panel */}
            <div className="lg:col-span-2">
              <Card className="border-white/[0.08] bg-white/[0.02] shadow-xl shadow-black/20 gap-0 py-0 overflow-hidden h-full">
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-emerald-500/10" />

                <Tabs defaultValue="files" className="flex flex-col h-full gap-0">
                  <div className="px-5 pt-4">
                    <TabsList className="w-full bg-white/[0.03] border border-white/[0.06] h-10 p-1 rounded-xl">
                      <TabsTrigger
                        value="files"
                        className="flex-1 data-[state=active]:bg-white/[0.08] data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded-lg text-neutral-500 text-sm transition-all"
                      >
                        <FileUp className="h-3.5 w-3.5 mr-1.5" />
                        Send Files
                      </TabsTrigger>
                      <TabsTrigger
                        value="chat"
                        className="flex-1 data-[state=active]:bg-white/[0.08] data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded-lg text-neutral-500 text-sm transition-all"
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
                    <div className="space-y-4">
                      <div
                        {...getRootProps()}
                        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all cursor-pointer p-8 group ${isDragActive
                          ? "border-cyan-500/70 bg-cyan-500/5 scale-[1.01]"
                          : "border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.03]"
                          }`}
                      >
                        <input {...getInputProps()} />
                        <motion.div
                          animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.08] group-hover:border-white/[0.12] transition-colors"
                        >
                          <Paperclip className="h-6 w-6 text-neutral-400 group-hover:text-neutral-300 transition-colors" />
                        </motion.div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-neutral-300">
                            {isDragActive ? "Drop to add files" : "Drag & drop files here"}
                          </p>
                          <p className="text-xs text-neutral-600 mt-1">
                            or <span className="text-neutral-400 underline underline-offset-2">click to browse</span> — any type, any size
                          </p>
                        </div>
                      </div>

                      <AnimatePresence>
                        {store.files.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                          >
                            {store.files.map((f, i) => {
                              const fs = store.fileStatuses[f.id];
                              const progress = fs && fs.totalChunks > 0 ? Math.round((fs.chunksReceived / fs.totalChunks) * 100) : 0;
                              const duration = fs?.completedAt && fs?.startedAt ? ((fs.completedAt - fs.startedAt) / 1000) : null;
                              return (
                                <motion.div
                                  key={f.id}
                                  initial={{ opacity: 0, x: -12 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 12 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 group hover:border-white/[0.1] transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                                      {fs?.status === "complete" ? (
                                        <Check className="h-4 w-4 text-emerald-400" />
                                      ) : fs?.status === "sending" ? (
                                        <FileUp className="h-4 w-4 text-cyan-400 animate-pulse" />
                                      ) : fs?.status === "receiving" ? (
                                        <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                                      ) : (
                                        <File className="h-4 w-4 text-neutral-500" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-neutral-200 truncate font-medium">{f.name}</p>
                                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                                        <span>{formatBytes(f.size)}</span>
                                        {fs?.status === "sending" && (
                                          <span className="text-cyan-400">{progress}%</span>
                                        )}
                                        {fs?.status === "receiving" && (
                                          <span className="text-emerald-400 font-medium">{progress}%</span>
                                        )}
                                        {fs?.status === "complete" && duration !== null && (
                                          <span className="flex items-center gap-1 text-emerald-500">
                                            <Clock className="h-3 w-3" />
                                            {duration < 1 ? '<1s' : `${duration.toFixed(1)}s`}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {fs?.status === "complete" && fs?.direction === "receiving" && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => swarm.downloadFile(f.id)}
                                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 px-2.5 rounded-lg text-xs gap-1.5"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                          Save
                                        </Button>
                                      )}
                                      {fs?.status === "complete" && fs?.direction !== "receiving" && (
                                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-1.5 py-0">
                                          Sent
                                        </Badge>
                                      )}
                                      {fs?.status === "sending" && (
                                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px] px-1.5 py-0 animate-pulse">
                                          Sending
                                        </Badge>
                                      )}
                                      {fs?.status === "receiving" && (
                                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-1.5 py-0 animate-pulse">
                                          Receiving
                                        </Badge>
                                      )}
                                      {(!fs || fs.status === "pending") && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => swarm.removeFile(f.id)}
                                              className="text-neutral-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>Remove file</TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </div>
                                  {(fs?.status === "sending" || fs?.status === "receiving") && (
                                    <div className="mt-2 h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${fs?.status === "receiving" ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-cyan-500 to-cyan-400"}`}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {store.transferState === "complete" && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3"
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm text-emerald-400 font-semibold">Files sent successfully!</p>
                              <p className="text-xs text-emerald-500/70">Peers are receiving the transfer</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Auto-send info */}
                      <div className="flex items-center gap-2 px-1 py-2 text-xs text-neutral-500">
                        <Zap className="h-3.5 w-3.5 text-cyan-500/50" />
                        {activePeers === 0
                          ? "Waiting for peers to connect…"
                          : "Files auto-send when added"}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Text Share tab */}
                  <TabsContent value="chat" className="flex-1 px-5 pb-5 pt-0 mt-0 flex flex-col gap-3">
                    <TextShare
                      messages={store.chatMessages}
                      onSend={(text) => swarm.sendTextMessage(text, displayName)}
                      disabled={activePeers === 0}
                      disabledText="Waiting for peers to connect…"
                      accentColor="cyan"
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
