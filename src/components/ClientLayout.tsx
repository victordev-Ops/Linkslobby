"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BottomNavbar from "./BottomNavbar";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profileId, setProfileId] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch current user's profile ID
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setProfileId(user?.id || null);
    };

    fetchProfile();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setProfileId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);
  
// inside src/components/ClientLayout.tsx
useEffect(() => {
  if ('clearAppBadge' in navigator) {
    (navigator as any).clearAppBadge();
  }
}, []);
      
  // Service Worker Registration
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const handleRegister = async () => {
        try {
          // CRITICAL FIX: Use the correct path based on your build output
          const reg = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none", // Prevent aggressive caching
          });
          console.log("✅ Service Worker registered:", reg.scope);

          // Force update check
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

  // Navbar Visibility Logic
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
    <body className={`font-sans antialiased min-h-screen bg-gray-50 ${shouldHideNavbar ? "pb-0" : "pb-24"}`}>
      <NotificationProvider profileId={profileId}>
        <main>{children}</main>
        {!shouldHideNavbar && <BottomNavbar />}
        <Toaster position="top-center" richColors />
      </NotificationProvider>
    </body>
  );
            }
