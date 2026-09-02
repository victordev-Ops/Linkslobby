import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import DykmGameClient from "./DykmGameClient"
import { Metadata } from "next"
import AdsterraDelayedSlot from '@/components/ads/AdsterraDelayedSlot'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  // Await params first in Next.js 15+
  const { slug } = await params
  return {
    title: `Do you know ${slug}?`,
    description: "Take the quiz to prove how well you know me!",
  }
}

export default async function DykmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  // 1. Get Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('slug', slug)
    .single()

  if (!profile) return notFound()

  // 2. Get Quiz Data
  const { data: quiz } = await supabase
    .from('dykm_quizzes')
    .select('questions')
    .eq('user_id', profile.id)
    .single()

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD] p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Oops! 🙈</h1>
          <p className="text-slate-500">{profile.username} hasn't set up their quiz yet.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <DykmGameClient profile={profile} questions={quiz.questions} />
      <div className="w-full max-w-md mx-auto px-4 pb-6">
        <AdsterraDelayedSlot delayMs={6000} stick maxHeightPx={155} />
      </div>
    </>
  )
}
