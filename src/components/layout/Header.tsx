"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.1] group-hover:border-white/[0.2] group-hover:bg-white/[0.08] transition-all duration-300">
            <Zap className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            THIS
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Badge className="hidden sm:inline-flex bg-white/[0.04] text-neutral-400 border-white/[0.08] px-2.5 py-1 text-[11px] font-medium tracking-wide gap-1.5 rounded-full">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            P2P Encrypted
          </Badge>

          {!isHome && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 border border-white/[0.08] hover:border-white/[0.15] rounded-lg px-3 py-1.5 transition-all"
                >
                  New room
                </Link>
              </TooltipTrigger>
              <TooltipContent>Create a new transfer room</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.15] transition-all"
              >
                <Github className="h-4 w-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent>View on GitHub</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
