"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight, Download, Zap, Shield, Globe, Lock,
  Wifi, Layers, Send, FileText, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { generateRoomCode } from "@/lib/mesh";

const features = [
  {
    icon: Lock,
    label: "End-to-End Encrypted",
    desc: "WebRTC DTLS encryption — your data never touches a server.",
  },
  {
    icon: Shield,
    label: "Zero Account Required",
    desc: "No sign-up, no tracking, no cookies. Just open and share.",
  },
  {
    icon: Globe,
    label: "Any Device, Anywhere",
    desc: "Works instantly in every modern browser — desktop or mobile.",
  },
  {
    icon: Layers,
    label: "No File Size Limit",
    desc: "Stream files of any size. No upload caps, ever.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create a Room",
    desc: "Click one button — get a unique room code instantly.",
    icon: Zap,
  },
  {
    step: "02",
    title: "Share the Code",
    desc: "Send the room code or share the link / QR to a friend.",
    icon: Send,
  },
  {
    step: "03",
    title: "Drop Files & Text",
    desc: "Files auto-send. Share code snippets. Everything is P2P.",
    icon: FileText,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSend = () => {
    setCreating(true);
    const code = generateRoomCode();
    router.push(`/room/${code}`);
  };

  const handleReceive = () => {
    const trimmed = roomCode.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setJoining(true);
    router.push(`/room/${trimmed}/receive`);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0a0a0a]">
      {/* Dotted grid background */}
      <div className="fixed inset-0 bg-dot-grid animate-grid-fade pointer-events-none" />

      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-100px] right-1/4 w-[400px] h-[300px] bg-emerald-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <Header />

      {/* HERO SECTION */}
      <main className="relative flex-1">
        <section className="flex flex-col items-center justify-center px-4 pt-32 pb-20 sm:pt-40 sm:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-3xl text-center"
          >
            {/* Status badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="mb-8 inline-flex"
            >
              <Badge className="bg-white/[0.06] text-neutral-300 border-white/[0.1] px-3.5 py-1.5 text-xs font-medium tracking-wide gap-2 rounded-full">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Browser-native P2P · No server storage
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.7 }}
              className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
            >
              <span className="text-gradient-hero">Share Files & Text</span>
              <br />
              <span className="text-gradient-hero">Instantly.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-base sm:text-lg text-neutral-500 max-w-lg mx-auto mb-12 leading-relaxed"
            >
              No account. No cloud. Share a link or scan a QR code — files travel{" "}
              <span className="text-neutral-300">directly between browsers</span>.
            </motion.p>

            {/* Main action card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="relative max-w-md mx-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 mb-16"
            >
              <div className="flex flex-col gap-4">
                <Button
                  size="lg"
                  onClick={handleSend}
                  disabled={creating}
                  className="h-14 text-base font-semibold bg-white text-black hover:bg-neutral-200 rounded-xl shadow-lg shadow-white/5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Zap className="h-5 w-5 mr-2" strokeWidth={2} />
                  {creating ? "Creating room…" : "Get Started"}
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>

                <div className="flex items-center gap-3">
                  <Separator className="flex-1 bg-white/[0.06]" />
                  <span className="text-xs text-neutral-600 font-medium">or join with a code</span>
                  <Separator className="flex-1 bg-white/[0.06]" />
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="ABCD12"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleReceive()}
                    maxLength={8}
                    className="h-12 bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15] focus:border-cyan-500/50 text-center font-mono text-lg tracking-[0.35em] placeholder:text-neutral-700 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm rounded-xl transition-colors"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleReceive}
                        disabled={roomCode.trim().length < 4 || joining}
                        className="h-12 px-5 border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.04] rounded-xl whitespace-nowrap transition-all"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        {joining ? "Joining…" : "Join"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Join an existing room to receive files</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* HOW IT WORKS */}
        <section className="relative px-4 py-20 sm:py-28">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                How it works
              </h2>
              <p className="text-neutral-500 text-base max-w-md mx-auto">
                Three steps. No setup. No downloads.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {steps.map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 transition-colors">
                      <s.icon className="h-4.5 w-4.5 text-neutral-400 group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <span className="text-xs font-mono text-neutral-600 tracking-widest uppercase">Step {s.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="relative px-4 py-20 sm:py-28">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                Everything you need
              </h2>
              <p className="text-neutral-500 text-base max-w-md mx-auto">
                P2P encryption · text & code sharing · QR codes · no limits.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feat, i) => (
                <motion.div
                  key={feat.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="group flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] flex-shrink-0 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 transition-colors">
                    <feat.icon className="h-5 w-5 text-neutral-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">{feat.label}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-4 py-20 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Ready to share?
            </h2>
            <p className="text-neutral-500 text-base mb-8 max-w-md mx-auto">
              No signup required. Create a room and start sharing files and text in seconds.
            </p>
            <Button
              size="lg"
              onClick={handleSend}
              disabled={creating}
              className="h-13 px-8 text-base font-semibold bg-white text-black hover:bg-neutral-200 rounded-xl shadow-lg shadow-white/5 transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              {creating ? "Creating room…" : "Get Started"}
              <ArrowUpRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>
        </section>

        {/* Giant brand typography — inspired by antigravity.google */}
        <section className="relative px-4 pt-16 pb-8 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <h2
              className="font-bold text-white select-none leading-[0.9] tracking-tighter text-center whitespace-nowrap"
              style={{
                fontSize: "clamp(4rem, 18vw, 22rem)",
              }}
            >
              Send This
            </h2>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
