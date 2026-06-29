// src/components/tod/ui/LobbyCloseToggle.tsx
"use client";

/**
 * LobbyCloseToggle
 * ----------------
 * A button the HOST can tap to close (lock out new joiners) or re-open their lobby.
 *
 * Schema note
 * -----------
 * This component uses `lobby.status === 'closed'` as the "closed" sentinel.
 * Make sure you extend the tod_lobbies status CHECK constraint to include 'closed':
 *
 *   ALTER TABLE tod_lobbies DROP CONSTRAINT IF EXISTS tod_lobbies_status_check;
 *   ALTER TABLE tod_lobbies ADD CONSTRAINT tod_lobbies_status_check
 *     CHECK (status = ANY(ARRAY['waiting','active','finished','closed']));
 *
 * If you would prefer a dedicated boolean column instead, add:
 *   ALTER TABLE tod_lobbies ADD COLUMN is_closed boolean DEFAULT false;
 * …and swap the action imports for your own implementation.
 *
 * Usage
 * -----
 * Drop this anywhere inside TODGameClient where `isHost` is true:
 *
 *   {isHost && lobby?.status !== 'active' && (
 *     <LobbyCloseToggle
 *       lobbyId={lobby.id}
 *       currentStatus={lobby.status}
 *       onToggled={(newStatus) => {
 *         // optionally update local lobby state — realtime will sync it anyway
 *       }}
 *     />
 *   )}
 */

import { useState } from "react";
import { Lock, LockOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { closeLobbyAction, openLobbyAction } from "@/actions/lobby-close";

interface LobbyCloseToggleProps {
  lobbyId: string;
  /** The lobby's current status value from the DB */
  currentStatus: string;
  /** Optional callback fired after a successful toggle */
  onToggled?: (newStatus: "closed" | "waiting") => void;
  /** Style variant — "button" (default) renders a labelled button; "icon" renders a compact icon-only version */
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
      const result = isClosed
        ? await openLobbyAction(lobbyId)
        : await closeLobbyAction(lobbyId);

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

  // Default: labelled button
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

/**
 * ClosedLobbyBadge
 * ----------------
 * Small inline badge to show on lobby cards when the lobby is closed.
 * Drop it next to the status badge in renderLobbyCard / WaitingRoom.
 */
export function ClosedLobbyBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
      <Lock size={9} />
      Closed
    </div>
  );
    }
