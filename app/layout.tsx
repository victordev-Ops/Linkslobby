// app/layout.tsx

import type { Metadata, Viewport } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import BottomNavbar from "@/components/BottomNavbar";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";
import ClientLayout from "@/components/ClientLayout";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "say", // Or "Ghost Message" if you prefer the example name
  description: "Receive anonymous confessions from anyone.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "say",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`\( {geistSans.variable} \){geistMono.variable}`}>
      <body>
        {/* All client-side logic (including providers, navbar, toaster, etc.) stays in ClientLayout */}
        <ClientLayout>
          <NotificationProvider>
            <BottomNavbar />
            {children}
            <Toaster />
          </NotificationProvider>
        </ClientLayout>
      </body>
    </html>
  );
}
