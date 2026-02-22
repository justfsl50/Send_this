"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Copy, Check, Send, MessageSquare, Code2, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/store/useSwarmStore";

interface TextShareProps {
    messages: ChatMessage[];
    onSend: (text: string) => void;
    disabled?: boolean;
    disabledText?: string;
    accentColor?: "cyan" | "emerald";
}

/** Detect if text looks like code (heuristic) */
function looksLikeCode(text: string): boolean {
    const codePatterns = [
        /^\s{2,}\S/m,
        /[{}();]\s*$/m,
        /^(import|export|const|let|var|function|class|def|if|for|while|return)\s/m,
        /=>/,
        /```/,
        /<\/?[a-z][a-z0-9]*[\s>]/i,
        /^\s*(\/\/|#|\/\*|\*)/m,
        /\.\w+\(/,
        /console\./,
        /npm |yarn |pip |git |curl /,
    ];

    if (text.split("\n").length >= 3) {
        return codePatterns.some(p => p.test(text));
    }
    return false;
}

/** Strip markdown code fence if present */
function stripCodeFence(text: string): { code: string; language: string } {
    const match = text.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (match) {
        return { code: match[2].trim(), language: match[1] || "" };
    }
    return { code: text, language: "" };
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-neutral-200 transition-all border border-white/[0.06] hover:border-white/[0.12]"
                >
                    {copied ? (
                        <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied!" : "Copy to clipboard"}</TooltipContent>
        </Tooltip>
    );
}

function MessageBubble({ msg, accent }: { msg: ChatMessage; accent: "cyan" | "emerald" }) {
    const isCode = looksLikeCode(msg.text);
    const isMultiLine = msg.text.includes("\n");
    const { code, language } = isCode ? stripCodeFence(msg.text) : { code: msg.text, language: "" };

    const ownBg = accent === "cyan"
        ? "bg-gradient-to-br from-cyan-500 to-cyan-400"
        : "bg-gradient-to-br from-emerald-500 to-emerald-400";

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col w-full ${msg.isOwn ? "items-end" : "items-start"}`}
        >
            {/* Sender name */}
            {!msg.isOwn && (
                <span className="text-[10px] text-neutral-500 mb-1 ml-2">{msg.senderName}</span>
            )}

            {/* Message content */}
            <div className={`relative group ${isCode || isMultiLine ? "w-full max-w-full" : "max-w-[85%]"}`}>
                {isCode ? (
                    // Code block styling
                    <div className="rounded-xl border border-white/[0.08] bg-[#111111] overflow-hidden">
                        {/* Code header */}
                        <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06]">
                            <div className="flex items-center gap-1.5">
                                <Code2 className="h-3 w-3 text-neutral-500" />
                                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
                                    {language || "code"}
                                </span>
                                {msg.isOwn && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/[0.08] text-neutral-500 ml-1">You</Badge>
                                )}
                            </div>
                            <CopyButton text={code} />
                        </div>
                        {/* Code content */}
                        <pre className="px-4 py-3 text-[13px] leading-relaxed text-neutral-200 font-mono overflow-x-auto whitespace-pre">
                            {code}
                        </pre>
                    </div>
                ) : isMultiLine ? (
                    // Multi-line text
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.isOwn
                        ? `${ownBg} text-black rounded-br-sm font-medium`
                        : "bg-white/[0.05] text-neutral-200 border border-white/[0.08] rounded-bl-sm"
                        }`}>
                        <pre className="whitespace-pre-wrap font-sans break-words">{msg.text}</pre>
                        <div className={`flex justify-end mt-1.5 ${msg.isOwn ? "opacity-70" : ""}`}>
                            <CopyButton text={msg.text} />
                        </div>
                    </div>
                ) : (
                    // Single-line message
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.isOwn
                        ? `${ownBg} text-black rounded-br-sm font-medium`
                        : "bg-white/[0.05] text-neutral-200 border border-white/[0.08] rounded-bl-sm"
                        }`}>
                        <div className="flex items-center gap-2">
                            <span className="break-words">{msg.text}</span>
                            <CopyButton text={msg.text} />
                        </div>
                    </div>
                )}
            </div>

            {/* Timestamp */}
            <span className="text-[10px] text-neutral-600 mt-1 mx-2">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
        </motion.div>
    );
}

export function TextShare({ messages, onSend, disabled, disabledText, accentColor = "cyan" }: TextShareProps) {
    const [text, setText] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }, [text]);

    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setText("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const accentBtn = accentColor === "cyan"
        ? "bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/20"
        : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20";

    const accentBorder = accentColor === "cyan"
        ? "focus:border-cyan-500/50"
        : "focus:border-emerald-500/50";

    return (
        <div className="flex-1 flex flex-col gap-3">
            {/* Messages area */}
            <ScrollArea className="h-80 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <div className="relative">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.03]">
                                <Type className="h-6 w-6 text-neutral-600" />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-neutral-400">Share text & code</p>
                            <p className="text-xs text-neutral-600 mt-1 max-w-[220px]">
                                Paste code snippets, links, or any text. Everything is copyable.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 pb-1">
                        {messages.map((msg) => (
                            <MessageBubble key={msg.id} msg={msg} accent={accentColor} />
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                )}
            </ScrollArea>

            {/* Input area */}
            <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        placeholder={disabled ? (disabledText || "Waiting for connection…") : "Paste code, text, or type a message…"}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        rows={1}
                        className={`w-full min-h-[44px] max-h-[200px] resize-none bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] ${accentBorder} rounded-xl transition-colors px-4 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                    <div className="absolute bottom-1 right-2 text-[9px] text-neutral-700 pointer-events-none">
                        Shift+Enter for new line
                    </div>
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={handleSend}
                            disabled={!text.trim() || disabled}
                            size="icon"
                            className={`h-11 w-11 ${accentBtn} text-black rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex-shrink-0`}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send text</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
