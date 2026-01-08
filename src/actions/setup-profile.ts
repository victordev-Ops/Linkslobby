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
    `${slug}-say`,
    `the-${slug}`
  ]

  return { available: false, slug, suggestions }
}

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Session expired. Please sign in again.' }

  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  /**
   * FIX: Using UPSERT instead of UPDATE.
   * Even though you have a trigger, UPSERT ensures that if the trigger is slow 
   * or fails, this action creates the row so the user isn't stuck in a loop.
   */
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,          // Primary Key
      email: user.email,    // Required by your schema
      username: username,
      slug: slug,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'      // Match existing row by ID
    })

  if (error) {
    console.error("Profile Setup Error:", error)
    // If the error is a duplicate slug, handle it gracefully
    if (error.code === '23505') return { error: 'That username is already taken.' }
    return { error: 'Could not save profile. Please try again.' }
  }

  // 1. Clear the Next.js Cache
  revalidatePath('/', 'layout') 
  
  // 2. Redirect to dashboard
  redirect('/dashboard')       
}
