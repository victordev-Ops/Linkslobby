import type { Metadata, Viewport } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import Script from "next/script";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "say",
  description: "Receive anonymous confessions from anyone.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "say",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="say" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="loading">
        <Script
          id="remove-loading"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                document.body.classList.remove('loading');
              });
              setTimeout(function() {
                document.body.classList.remove('loading');
              }, 2000);
            `,
          }}
        />
        <ClientLayout>{children}</ClientLayout>
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
