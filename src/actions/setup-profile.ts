'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/**
 * Checks if a username (slug) is taken and provides alternatives.
 */
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

/**
 * Creates or updates the user profile with the chosen username.
 */
export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()
  
  // 1. Get the current authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Session expired. Please sign in again.' }
  }

  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // 2. Use UPSERT instead of UPDATE
  // This handles cases where the profile row wasn't created yet.
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,          // Primary key for matching
      email: user.email,    // Required by your schema (not null)
      username: username,   // The display name
      slug: slug,           // The unique handle
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'id'      // Tells Supabase to update if 'id' exists, insert if not
    })

  if (error) {
    console.error("Profile Setup Error:", error)
    return { error: 'Could not save profile. That handle might be taken.' }
  }

  // 3. Clear the cache and redirect
  // revalidatePath ensures the middleware/dashboard sees the new 'username' data
  revalidatePath('/', 'layout') 
  redirect('/dashboard')       
    }
