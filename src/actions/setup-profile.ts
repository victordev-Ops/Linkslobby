'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'ice/navigation'
import { revalidatePath } from 'next/cache' // optional, for cache busting

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Auth session missing')
  }

  // Generate slug (same logic as before)
  let baseSlug = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  if (!baseSlug) baseSlug = `user-${user.id.slice(0, 8)}`

  let slug = baseSlug
  let i = 0

  // Check for slug conflicts
  while (i < 20) { // increased limit just in case
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!data) break
    i++
    slug = `\( {baseSlug}- \){i}`
  }

  if (i >= 20) {
    throw new Error('Too many users with similar usernames. Please try a more unique one.')
  }

  // CHANGE: Use upsert (or update) instead of insert
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email!,
        username,
        slug,
        // Add any other fields you want to set
        // updated_at: new Date().toISOString(), // if you have this column
      },
      {
        onConflict: 'id', // This tells Supabase to update if id exists
      }
    )

  if (error) {
    console.error('Error updating profile:', error)
    
    // Better error handling
    if (error.code === '23505' && error.message.includes('username')) {
      throw new Error('This username is already taken. Please choose another.')
    }
    
    throw new Error('Could not create profile. Please try again.')
  }

  // Optional: Revalidate paths if needed
  revalidatePath('/')

  redirect('/')
    }
