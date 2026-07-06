// app/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import LandingClient from '@/components/landing/LandingClient'

export const metadata: Metadata = {
  title: "Linkslobby — Play. Confess. Connect.",
  description:
    "Send confessions, play Truth or Dare, host a Hot Seat, or drop an anonymous message — real games with the friends you already have. Earn stars as you play.",
  openGraph: {
    title: "Linkslobby — Play. Confess. Connect.",
    description:
      "Games, confessions & anonymous messages with your friends. Earn stars as you play.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Linkslobby — Play. Confess. Connect.",
    description:
      "Games, confessions & anonymous messages with your friends. Earn stars as you play.",
  },
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Signed-in users with a completed profile go straight to the dashboard.
  // Everyone else (including signed-in-but-incomplete, which middleware
  // will route to /auth/setup on their next navigation) sees the pitch.
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, slug')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.username && profile?.slug) {
      redirect('/dashboard')
    }
  }

  return <LandingClient />
    }
