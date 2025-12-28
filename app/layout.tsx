import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";  // ← New official import
import "./globals.css";
import BottomNavbar from "@/components/BottomNavbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Suspense } from "react";

const geistSans = GeistSans;  // Already configured with variable
const geistMono = GeistMono;  // Already configured with variable

export const metadata: Metadata = {
  title: "say",
  description: "Receive anonymous confessions from anyone.",
};

function BottomNavbarFallback() {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-gray-50 border-t border-gray-200" />
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profileId = user?.id ?? null;

  return (
    <html lang="en" className={`\( {geistSans.variable} \){geistMono.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-gray-50 pb-24">
        {children}

        <Suspense fallback={<BottomNavbarFallback />}>
          {profileId ? (
            <BottomNavbar profileId={profileId} />
          ) : (
            <div className="h-24" />
          )}
        </Suspense>
      </body>
    </html>
  );
        }
