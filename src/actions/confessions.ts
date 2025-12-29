// app/actions/confessions.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markConfessionAsRead(id: string) {
  const supabase = await createSupabaseServerClient()

  try {
    const { error } = await supabase
      .from('confessions')
      .update({ is_read: true })
      .eq('id', id)

    if (error) throw error

    // THE MAGIC FIX:
    // This tells Next.js "Purge the cache for /inbox immediately"
    // When the user goes back, the server will fetch fresh data.
    revalidatePath('/inbox')
    
    return { success: true }
  } catch (error) {
    console.error('Server Action Error:', error)
    return { success: false, error }
  }
               }
      
