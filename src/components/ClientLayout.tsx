// components/ClientLayout.tsx

"use client";

import { usePathname } from "next/navigation";
import BottomNavbar from "./BottomNavbar";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";
import { ReactNode } from "react";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Paths where navbar should be HIDDEN
  const hideNavbarPaths = [
    "/login",
    "/signup",
    "/onboarding",
    "/welcome",
    "/auth/setup",
    "/auth",
    "/fullscreen",
  ];

  const shouldHideNavbar =
    hideNavbarPaths.includes(pathname) || pathname.startsWith("/confess/") || pathname.startsWith("/auth/");;

  const bodyPadding = shouldHideNavbar ? "pb-0" : "pb-24";

  return (
    <body className={`font-sans antialiased min-h-screen bg-gray-50 ${bodyPadding}`}>
      <NotificationProvider>
        {children}

        {!shouldHideNavbar && <BottomNavbar />}

        <Toaster position="top-center" richColors />
      </NotificationProvider>
    </body>
  );
}
