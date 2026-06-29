// src/components/tod/ui/LobbyCloseToggle.tsx
"use client";

import { useState } from "react";
import { Lock, LockOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { closeLobbyAction, openLobbyAction } from "@/actions/lobby-close";

interface LobbyCloseToggleProps {
  lobbyId: string;
  currentStatus: string;
  onToggled?: (newStatus: "closed" | "waiting") => void;
  variant?: "button" | "icon";
}

export function LobbyCloseToggle({
  lobbyId,
  currentStatus,
  onToggled,
  variant = "button",
}: LobbyCloseToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isClosed = currentStatus === "closed";

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      let result;
      if (isClosed) {
        result = await openLobbyAction(lobbyId);
      } else {
        result = await closeLobbyAction(lobbyId);
      }

      if (!result.success) {
        toast.error(result.message ?? "Failed to update lobby");
        return;
      }

      toast.success(
        result.newStatus === "closed"
          ? "Lobby closed — no new players can join 🔒"
          : "Lobby opened — players can join again 🔓"
      );
      onToggled?.(result.newStatus);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        title={isClosed ? "Open lobby" : "Close lobby"}
        className={`p-2 rounded-xl transition-all active:scale-95 disabled:opacity-50 ${
          isClosed
            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
            : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 border border-slate-700/50"
        }`}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isClosed ? (
          <Lock size={16} />
        ) : (
          <LockOpen size={16} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border ${
        isClosed
          ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
          : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/60 hover:text-white"
      }`}
    >
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isClosed ? (
        <Lock size={14} />
      ) : (
        <LockOpen size={14} />
      )}
      {isLoading ? "Updating…" : isClosed ? "Open Lobby" : "Close Lobby"}
    </button>
  );
}

export function ClosedLobbyBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
      <Lock size={9} />
      Closed
    </div>
  );
}
