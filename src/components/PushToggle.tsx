"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function PushToggle({ userId }: { userId: string }) {
  const { subscribe, unsubscribe } = usePushSubscription();
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Check current permission and browser support on mount
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setIsSupported(false);
      return;
    }
    
    setIsEnabled(Notification.permission === "granted");
  }, []);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      if (isEnabled) {
        await unsubscribe(userId);
      } else {
        await subscribe(userId);
      }
      setIsEnabled(Notification.permission === "granted");
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-100 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-200 text-gray-500">
            <BellOff size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Push Notifications</p>
            <p className="text-xs text-gray-500">Not supported on this browser</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          isEnabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
        )}>
          {isEnabled ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Push Notifications</p>
          <p className="text-xs text-gray-600">
            {isEnabled ? "You'll receive notifications" : "Get notified of new confessions"}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className="relative h-7 w-12 cursor-pointer outline-none"
        aria-label="Toggle push notifications"
      >
        {/* Toggle Background */}
        <div className={cn(
          "h-full w-full rounded-full transition-colors duration-300",
          isEnabled ? "bg-green-600" : "bg-gray-300",
          loading && "opacity-50"
        )} />
        
        {/* Toggle Knob */}
        <motion.div
          className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md"
          animate={{ x: isEnabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {loading && <Loader2 size={12} className="animate-spin text-gray-600" />}
        </motion.div>
      </button>
    </div>
  );
            }
