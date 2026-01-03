"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper for Tailwind classes (already in your package.json)
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function PushToggle({ userId }: { userId: string }) {
  const { subscribe } = usePushSubscription();
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check current permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setIsEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      await subscribe(userId);
      setIsEnabled(Notification.permission === "granted");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          isEnabled ? "bg-green-500/10 text-green-500" : "bg-zinc-800 text-zinc-400"
        )}>
          {isEnabled ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div>
          <p className="text-sm font-medium text-white">Push Notifications</p>
          <p className="text-xs text-zinc-400">Get notified of new confessions</p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className="relative h-7 w-12 cursor-pointer outline-none"
      >
        {/* Toggle Background */}
        <div className={cn(
          "h-full w-full rounded-full transition-colors duration-300",
          isEnabled ? "bg-green-600" : "bg-zinc-700",
          loading && "opacity-50"
        )} />
        
        {/* Toggle Knob */}
        <motion.div
          className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md"
          animate={{ x: isEnabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {loading && <Loader2 size={12} className="animate-spin text-zinc-600" />}
        </motion.div>
      </button>
    </div>
  );
}
