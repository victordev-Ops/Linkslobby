'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()
  
  // 1. Get user with 'getUser' (more secure than 'getSession')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Session expired. Please sign in.' }

  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // 2. We use 'upsert' but specifically target the ID
  // This handles both new users and people changing their username later
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,          
      email: user.email,    
      username: username,
      slug: slug,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error("Database Error:", error.message)
    return { error: error.message }
  }

  // 3. Clear cache and return success
  revalidatePath('/', 'layout') 
  revalidatePath('/dashboard')
  
  return { success: true }       
}
