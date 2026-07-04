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

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profileId, setProfileId] = useState<string | null>(null);
  const supabase = createClient();

  // Initialize XP notification handler
  useEffect(() => {
    setXPNotificationHandler(showXPNotification);
  }, []);

  // 1. Fetch current user's profile ID for notifications
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setProfileId(user?.id || null);
    };

    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setProfileId(session?.user?.id || null);
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
              <Toaster position="top-center" richColors />
              <PWAInstallPrompt />
            </div>
          </XPNotificationProvider>
        </NotificationProvider>
      </PresenceProvider>
    </AuthProvider>
  );
}
