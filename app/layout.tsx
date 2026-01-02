// app/layout.tsx
"use client";
import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import BottomNavbar from "@/components/BottomNavbar";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "say",
  description: "Receive anonymous confessions from anyone.",
};

// Client wrapper to use usePathname
function LayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Define conditions to HIDE the BottomNavbar
  const hideNavbarPaths = [
    "/login",
    "/signup",
    "/onboarding",
    "/welcome",
    "/auth",
    "/fullscreen", // add any other static routes here
  ];

  // Hide navbar on any /confess/[slug] page
  const shouldHideNavbar =
    hideNavbarPaths.includes(pathname) || pathname.startsWith("/confess/");

  // Adjust bottom padding accordingly
  const bodyPadding = shouldHideNavbar ? "pb-0" : "pb-24";

  return (
    <body
      className={`font-sans antialiased min-h-screen bg-gray-50 ${bodyPadding}`}
    >
      <NotificationProvider>
        {children}

        {/* Show navbar only when not hidden */}
        {!shouldHideNavbar && <BottomNavbar />}

        <Toaster position="top-center" richColors />
      </NotificationProvider>
    </body>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`\( {geistSans.variable} \){geistMono.variable}`}>
      <LayoutContent>{children}</LayoutContent>
    </html>
  );
}
