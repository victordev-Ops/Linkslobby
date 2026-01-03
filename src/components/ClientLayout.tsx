"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import BottomNavbar from "./BottomNavbar";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 1. Service Worker Registration
  useEffect(() => {
    // Only register in production to avoid caching issues during development
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const handleRegister = async () => {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          console.log("Service Worker registered with scope:", reg.scope);
        } catch (error) {
          console.error("Service Worker registration failed:", error);
        }
      };

      // Register after page load to ensure smooth initial performance
      if (document.readyState === "complete") {
        handleRegister();
      } else {
        window.addEventListener("load", handleRegister);
        return () => window.removeEventListener("load", handleRegister);
      }
    }
  }, []);

  // 2. Navbar Visibility Logic
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
      <NotificationProvider>
        <main>{children}</main>

        {!shouldHideNavbar && <BottomNavbar />}

        <Toaster position="top-center" richColors />
      </NotificationProvider>
    </body>
  );
}
