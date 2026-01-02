'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()

  // 1. Check Auth Session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Auth session missing')
  }

  // 2. Sanitize and generate the Slug
  let slug = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/(^-|-$)/g, '')     // Remove leading/trailing hyphens

  // Fallback if the sanitization removes everything (e.g. username was just emojis)
  if (!slug) {
    throw new Error('Username invalid. Please use letters or numbers.')
  }

  // 3. CHECK AVAILABILITY: Check if this slug is already taken
  // We exclude the current user's ID to allow them to "claim" it if they are re-submitting their own form.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('slug', slug)
    .neq('id', user.id) // Don't block if the conflict is the user themselves
    .maybeSingle()

  if (existingProfile) {
    throw new Error('This username is already taken. Please choose another.')
  }

  // 4. Upsert Profile
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email!,
        username, // The display name
        slug,     // The unique handle
        //updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'id',
      }
    )

  if (error) {
    console.error('Error updating profile:', error)
    // Fallback for race conditions (if two people submit exact same time)
    if (error.code === '23505') { 
      throw new Error('This username is already taken. Please choose another.')
    }
    throw new Error('Could not create profile. Please try again.')
  }

  revalidatePath('/')
  redirect('/')
          }
