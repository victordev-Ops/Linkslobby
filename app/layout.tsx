// app/layout.tsx

import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import BottomNavbar from "@/components/BottomNavbar";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";

// This inner component will be a Client Component
import ClientLayout from "@/components/ClientLayout";  // We'll create this next

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "say",
  description: "Receive anonymous confessions from anyone.",
};

// RootLayout remains a Server Component (no "use client")
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`\( {geistSans.variable} \){geistMono.variable}`}>
      {/* All client-side logic moved here */}
      <ClientLayout>{children}</ClientLayout>
    </html>
  );
}
