"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BottomNavbar from "./BottomNavbar";
import { NotificationProvider } from "@/context/NotificationContext";
import { AuthProvider } from "@/context/AuthContext";
import { XPNotificationProvider } from "@/components/XPNotificationProvider";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { setXPNotificationHandler } from "@/lib/xp";
import { showXPNotification } from "@/components/XPNotification";

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

  // 4. Navbar Visibility Logic
  const shouldHideNavbar = useMemo(() => {
    const hideNavbarPaths = [
      "/login",
      "/signup",
      "/onboarding",
      "/welcome",
      "/auth/setup",
      "/auth",
      "/fullscreen",
    ];

    return (
      hideNavbarPaths.includes(pathname) || 
      pathname.startsWith("/confess/") || 
      pathname.startsWith("/auth/")
    );
  }, [pathname]);

  return (
    <AuthProvider> 
      <NotificationProvider profileId={profileId}>
        <XPNotificationProvider>
          <div className={`min-h-screen ${shouldHideNavbar ? "pb-0" : "pb-24"}`}>
            <main>{children}</main>
            {!shouldHideNavbar && <BottomNavbar />}
            <Toaster position="top-center" richColors />
          </div>
        </XPNotificationProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
