// app/actions/confessions.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
