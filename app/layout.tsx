// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
// Removed Script import

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "say",
  description: "Receive anonymous confessions from anyone.",
  // ... rest of metadata
};

export const viewport: Viewport = {
  themeColor: "#7C3AED",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="say" />
      </head>
      {/* Remove className="loading" and the Script tag */}
      <body className="bg-slate-50"> 
        <ClientLayout>{children}</ClientLayout>
        {/* PWA prompt is inside ClientLayout or handled there */}
      </body>
    </html>
  );
}
