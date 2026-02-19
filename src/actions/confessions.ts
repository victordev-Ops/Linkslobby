// app/actions/confessions.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function sendAmaQuestion(profileId: string, message: string) {
  const supabase = await createSupabaseServerClient()

  const headersList = await headers()
  const ua = headersList.get('user-agent') || 'unknown'
  const lang = headersList.get('accept-language') || 'unknown'
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  const metadata = JSON.stringify({ ua, lang, ip, t: Date.now() })
  const messageWithMeta = `${message}\n\n[META:${metadata}]`

  const { error } = await supabase
    .from('confessions')
    .insert({
      profile_id: profileId,
      message: messageWithMeta,
      message_type: 'ama'
    })

  if (error) throw error
  return { success: true }
}

export async function markConfessionAsRead(id: string) {
  const supabase = await createSupabaseServerClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Verify ownership before updating
    const { data: confession } = await supabase
      .from('confessions')
      .select('profile_id')
      .eq('id', id)
      .single()

    if (!confession || confession.profile_id !== user.id) {
      throw new Error('Unauthorized or confession not found')
    }

    const { error } = await supabase
      .from('confessions')
      .update({ is_read: true })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/inbox')

    return { success: true }
  } catch (error) {
    console.error('Server Action Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function reportMessage(confessionId: string, reason?: string) {
  const supabase = await createSupabaseServerClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { error } = await supabase
      .from('reports')
      .upsert({
        reporter_id: user.id,
        confession_id: confessionId,
        reason: reason || null,
      }, { onConflict: 'reporter_id,confession_id', ignoreDuplicates: true })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Report Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function deleteMessage(confessionId: string) {
  const supabase = await createSupabaseServerClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Verify ownership
    const { data: confession } = await supabase
      .from('confessions')
      .select('profile_id')
      .eq('id', confessionId)
      .single()

    if (!confession || confession.profile_id !== user.id) {
      return { success: false, error: 'Not authorized to delete this message' }
    }

    const { error } = await supabase
      .from('confessions')
      .delete()
      .eq('id', confessionId)

    if (error) throw error

    revalidatePath('/inbox')
    return { success: true }
  } catch (error) {
    console.error('Delete Message Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
