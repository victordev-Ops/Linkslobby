"use server"

import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Service-role client — server-only, bypasses RLS.
// Required so anonymous (not-logged-in) quiz-takers can save a score even if
// your dykm_scores RLS INSERT policy is scoped to auth.uid() (which blocks
// anonymous/guest responders). Never import this client into client components.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type SaveScorePayload = {
  quizOwnerId: string
  responderName: string
  score: number
  totalQuestions: number
  answers: unknown[]
}

export async function saveDykmScore(payload: SaveScorePayload) {
  try {
    if (!payload.quizOwnerId || !payload.responderName?.trim()) {
      return { success: false, message: "Missing required fields" }
    }

    // If the player happens to already be logged in, attach their id so the
    // score is linked to their profile — but this is optional, not required.
    let responderId: string | null = null
    try {
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      responderId = user?.id ?? null
    } catch {
      // Not logged in / no session — fine, proceed as anonymous.
    }

    const { data, error } = await supabaseAdmin
      .from("dykm_scores")
      .insert({
        quiz_owner_id: payload.quizOwnerId,
        responder_id: responderId,
        responder_name: payload.responderName.trim().slice(0, 60),
        score: payload.score,
        total_questions: payload.totalQuestions,
        answers: payload.answers,
      })
      .select("id")
      .single()

    if (error) {
      console.error("[saveDykmScore] insert failed:", error.message)
      return { success: false, message: error.message }
    }

    return { success: true, scoreId: data.id as string }
  } catch (err) {
    console.error("[saveDykmScore] unexpected error:", err)
    return { success: false, message: "Unexpected error saving score" }
  }
}
