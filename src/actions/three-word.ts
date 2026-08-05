// app/actions/three-word.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { parseThreeWords } from '@/hooks/three-word'

export type ThreeWordActionResponse = { error?: string; success?: boolean }

// Short, URL-safe, matches the shape of tod_lobbies.slug / hot_seat_sessions.slug.
function generateSlug(): string {
  return (
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 5)
  )
}

// TODO(analytics): fire "Game Started" here through the project's existing
// analytics call once this file is wired into the real codebase — this
// module intentionally avoids guessing at that import so it doesn't break
// the build. Same TODO applies at the "Link Shared" / "Link Opened" /
// "Response Submitted" / "Response Viewed" points marked below.

/**
 * Starts (or resumes) the host's Three Word Game session. One always-on
 * active session per host, mirroring the single persistent link pattern
 * used by /confess, /ama, and /dykm rather than minting a new link per call.
 */
export async function startThreeWordSession(): Promise<ThreeWordActionResponse & { slug?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { data: existing } = await supabase
    .from('three_word_sessions')
    .select('slug')
    .eq('host_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return { success: true, slug: existing.slug }

  let slug = generateSlug()
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: taken } = await supabase
      .from('three_word_sessions')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!taken) break
    slug = generateSlug()
  }

  const { data, error } = await supabase
    .from('three_word_sessions')
    .insert({ host_id: user.id, slug })
    .select('slug')
    .single()

  if (error || !data) {
    console.error('startThreeWordSession error:', error)
    return { error: 'Could not start a new game. Please try again.' }
  }

  // TODO(analytics): track('Game Started', { game: 'three_word' })

  revalidatePath('/three-words')
  return { success: true, slug: data.slug }
}

export async function getActiveThreeWordSession() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('three_word_sessions')
    .select('id, slug, status, created_at')
    .eq('host_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  return data
}

/**
 * Public submission — mirrors sendConfessionAction / sendAmaQuestion: same
 * IP + user block-list checks, same anonymous-unless-signed-in sender
 * tracking, same shape of return value.
 */
export async function submitThreeWordResponse(slug: string, rawWords: string): Promise<ThreeWordActionResponse> {
  const parsed = parseThreeWords(rawWords)
  if (!parsed.valid) return { error: parsed.error }

  const supabase = await createSupabaseServerClient()

  const { data: session } = await supabase
    .from('three_word_sessions')
    .select('id, host_id, status')
    .eq('slug', slug)
    .maybeSingle()

  if (!session || session.status !== 'active') {
    return { error: 'This game is no longer accepting responses.' }
  }

  const { data: { user } } = await supabase.auth.getUser()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  const { isAnonymousBlocked, isUserBlocked } = await import('@/actions/blocked-users')

  const ipBlocked = await isAnonymousBlocked(session.host_id, ip)
  if (ipBlocked) return { error: 'Unable to deliver your response.' }

  if (user) {
    const userBlocked = await isUserBlocked(session.host_id, user.id)
    if (userBlocked) return { error: 'Unable to deliver your response.' }
  }

  const { error } = await supabase
    .from('three_word_responses')
    .insert({
      session_id: session.id,
      host_id: session.host_id,
      words: parsed.words.join(' '),
      sender_id: user?.id || null,
    })

  if (error) {
    console.error('submitThreeWordResponse insert error:', error)
    return { error: 'Failed to send your response. Please try again.' }
  }

  // TODO(analytics): track('Response Submitted', { game: 'three_word' })

  return { success: true }
}

const PAGE_SIZE = 20

/**
 * Paginated results for the host's own game — cursor is the `created_at`
 * of the last row seen, same "keyset" style pagination shape the rest of
 * the app's infinite-scrolling feeds use.
 */
export async function getThreeWordResponses(cursor?: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { responses: [], nextCursor: null }

  let query = supabase
    .from('three_word_responses')
    .select('id, words, created_at, is_read, sender_id')
    .eq('host_id', user.id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) {
    console.error('getThreeWordResponses error:', error)
    return { responses: [], nextCursor: null }
  }

  const nextCursor = data && data.length === PAGE_SIZE ? data[data.length - 1].created_at : null

  // TODO(analytics): track('Response Viewed', { game: 'three_word', count: data?.length ?? 0 })

  return { responses: data || [], nextCursor }
}

export async function markThreeWordResponseRead(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('three_word_responses')
    .update({ is_read: true })
    .eq('id', id)
    .eq('host_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/three-words')
  revalidatePath('/notifications')
  return { success: true }
}

export async function deleteThreeWordResponse(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('three_word_responses')
    .delete()
    .eq('id', id)
    .eq('host_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/three-words')
  return { success: true }
}

/**
 * Reuses the shared `reports` table via its generic context/context_id
 * columns — the same mechanism already used for report types beyond plain
 * confessions, so moderation tooling built against `reports` picks these up
 * for free.
 */
export async function reportThreeWordResponse(responseId: string, reason?: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      report_type: 'three_word',
      context: 'three_word_responses',
      context_id: responseId,
      reason: reason || null,
    })

  if (error) {
    console.error('reportThreeWordResponse error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function closeThreeWordSession(sessionId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('three_word_sessions')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('host_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/three-words')
  return { success: true }
}
