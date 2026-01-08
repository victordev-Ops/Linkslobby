'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function checkUsernameAvailability(username: string) {
  const supabase = await createSupabaseServerClient()
  
  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (slug.length < 3) return { available: false, suggestions: [] }

  const { data } = await supabase
    .from('profiles')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return { available: true, slug, suggestions: [] }

  const suggestions = [
    `${slug}${Math.floor(Math.random() * 99)}`,
    `${slug}-studio`,
    `its-${slug}`
  ]

  return { available: false, slug, suggestions }
}

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Auth session missing. Please log in again.' }

  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // We utilize the row created by the Postgres Trigger.
  // We only need to UPDATE, not UPSERT.
  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      slug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error("Profile update error:", error)
    return { error: 'Could not update profile. Please try again.' }
  }

  revalidatePath('/dashboard', 'layout') 
  redirect('/dashboard')       
}
