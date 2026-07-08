"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import NavbarWrapper from "./NavbarWrapper";
import { NotificationProvider } from "@/context/NotificationContext";
import { PresenceProvider } from "@/context/PresenceContext";
import { AuthProvider } from "@/context/AuthContext";
import { XPNotificationProvider } from "@/components/XPNotificationProvider";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { setXPNotificationHandler } from "@/hooks/xp";
import { showXPNotification } from "@/components/XPNotification";
import PWAInstallPrompt from "./PWAInstallPrompt";
import NotificationRegister from "./NotificationRegister";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profileId, setProfileId] = useState<string | null>(null);
  const supabase = createClient();

  // Initialize XP notification handler
  useEffect(() => {
    setXPNotificationHandler(showXPNotification);
  }, []);

  // 1. Fetch current user's profile ID for notifications, and warm up
  //    Realtime's private-channel authorization at the same time.
  //
  //    Private Broadcast channels (e.g. the `dm:user:<uid>` channel DMs use
  //    for instant delivery) need `supabase.realtime.setAuth()` to complete
  //    before a channel join can be authorized. That used to happen lazily,
  //    awaited, inside DirectMessageClient on every single thread mount —
  //    an extra token round trip sitting directly in front of message
  //    delivery, which is why DMs updated noticeably slower than
  //    confessions/tod lobbies/etc. (those ride plain `postgres_changes`
  //    subscriptions, which need no separate auth handshake). Doing it here,
  //    once, at the app root that never unmounts, means the socket is
  //    already authorized well before any DM thread opens.
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setProfileId(session?.user?.id || null);
      supabase.realtime.setAuth(session?.access_token ?? null);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setProfileId(session?.user?.id || null);
      // Keep Realtime's auth in sync on every token refresh — a stale token
      // here would make private channel joins fail (or silently hang) right
      // when the access token rotates, which otherwise shows up as exactly
      // this kind of intermittent multi-second delay.
      supabase.realtime.setAuth(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // 2. Clear Badges
  useEffect(() => {
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge();
    }
  }, []);

  // 3. Service Worker Registration
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const handleRegister = async () => {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          });
          reg.update();
        } catch (error) {
          console.error("❌ Service Worker registration failed:", error);
        }
      };

      if (document.readyState === "complete") {
        handleRegister();
      } else {
        window.addEventListener("load", handleRegister);
        return () => window.removeEventListener("load", handleRegister);
      }
    }
  }, []);

  return (
    <AuthProvider>
      {/*
        PresenceProvider goes here — same level as NotificationProvider,
        wrapping everything, using the same profileId already fetched
        above. This is the ONE persistent client boundary in the whole app
        (ClientLayout itself never remounts across navigations, since
        RootLayout renders it once), so mounting the presence channel here
        is what makes "online" actually mean "anywhere in the app" instead
        of "on this specific page." It was previously never mounted at all,
        which is why status always read Offline regardless of what the
        DM header logic did with it.
      */}
      <PresenceProvider userId={profileId}>
        <NotificationProvider profileId={profileId}>
          <XPNotificationProvider>
            <div className="min-h-screen transition-all">
              <main>{children}</main>
              <Suspense fallback={null}>
                <NavbarWrapper />
              </Suspense>
              {/*
                The ONE and ONLY <Toaster> in the app. Every showAppToast()/
                showXPNotification() call renders through this single mount.
                Previously XPNotificationProvider also rendered its own
                <Toaster>, so every toast was rendered twice — that's what
                caused toasts to visually stack and overlap. Do not add
                another <Toaster> anywhere else in the tree.
              */}
              <Toaster position="top-center" richColors gap={10} />
              <NotificationRegister />
              <PWAInstallPrompt />
            </div>
          </XPNotificationProvider>
        </NotificationProvider>
      </PresenceProvider>
    </AuthProvider>
  );
    }
