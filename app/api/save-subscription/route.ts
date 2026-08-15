import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// POST /api/save-subscription
//
// Called from the client right after `pushManager.subscribe()` succeeds
// (the "[notifications channel] status=SUBSCRIBED" log happens first,
// this call persists the resulting PushSubscription so a server-side job
// can actually send to it later). This route didn't exist yet, which is
// why every save was 404ing and nothing ever landed in `profiles.push_subscription`.
//
// Expected body: the browser's PushSubscription, JSON.stringify'd as-is —
// i.e. `{ endpoint, keys: { p256dh, auth }, expirationTime }`.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let subscription: unknown
  try {
    subscription = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !subscription ||
    typeof subscription !== 'object' ||
    !('endpoint' in subscription) ||
    !('keys' in subscription)
  ) {
    return NextResponse.json(
      { error: 'Body must be a PushSubscription with endpoint + keys' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('profiles')
    .update({ push_subscription: subscription })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to save push subscription:', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/save-subscription
//
// Call this from the client when the user disables notifications or the
// subscription is invalidated (e.g. `pushManager.getSubscription()` +
// `.unsubscribe()`), so a stale endpoint doesn't stay saved and get sent
// to on future notifications.
export async function DELETE() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ push_subscription: null })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to clear push subscription:', error)
    return NextResponse.json({ error: 'Failed to clear subscription' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
