import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import BottomNavbar from "@/components/BottomNavbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationProvider } from "@/context/NotificationContext"; // 1. Import Provider
import { Toaster } from "sonner"; // 2. Import Toaster

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "say",
  description: "Receive anonymous confessions from anyone.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // We pass this ID to the Provider, not the Navbar
  const profileId = user?.id ?? null;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-gray-50 pb-24">
        {/* 3. Wrap application in the Provider */}
        <NotificationProvider profileId={profileId}>
          
          {children}

          {/* 4. Render Navbar globally if user exists (No props needed!) */}
          {profileId && <BottomNavbar />}
          
          {/* 5. Global Toast Notification Container */}
          <Toaster position="top-center" richColors />

        </NotificationProvider>
      </body>
    </html>
  );
}
