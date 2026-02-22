import { Shield, Infinity, Globe, Zap } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.05] bg-[#0a0a0a]/80 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08]">
              <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold text-white">
              THIS
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-neutral-600">
            <span className="flex items-center gap-1.5 hover:text-neutral-400 transition-colors cursor-default">
              <Shield className="h-3 w-3" />
              No account
            </span>
            <span className="flex items-center gap-1.5 hover:text-neutral-400 transition-colors cursor-default">
              <Infinity className="h-3 w-3" />
              No size limit
            </span>
            <span className="flex items-center gap-1.5 hover:text-neutral-400 transition-colors cursor-default">
              <Globe className="h-3 w-3" />
              No cloud
            </span>
          </div>

          <p className="text-xs text-neutral-700">
            Browser-native P2P · WebRTC
          </p>
        </div>
      </div>
    </footer>
  );
}
