'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Checks if a username is taken and generates suggestions if it is.
 */
export async function checkUsernameAvailability(username: string) {
  const supabase = await createSupabaseServerClient()
  
  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  
  if (slug.length < 3) {
    return { available: false, slug, suggestions: [] }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error("Check Username Error:", error.message)
    return { available: false, slug, suggestions: [] }
  }

  // If no data is returned, the slug is available
  if (!data) {
    return { available: true, slug, suggestions: [] }
  }

  // Generate suggestions if taken
  const suggestions = [
    `${slug}${Math.floor(Math.random() * 99)}`,
    `${slug}-say`,
    `the-${slug}`
  ]

  return { available: false, slug, suggestions }
}

/**
 * Creates or updates the user profile in the database.
 */
export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Session expired. Please sign in again.' }
  }

  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // Check if this is a new profile (first time setup)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const isNewProfile = !existingProfile

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,          
      email: user.email,    
      username: username,
      slug: slug,
      xp_balance: isNewProfile ? 100 : undefined, // Set initial XP for new profiles
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'      
    })

  if (error) {
    console.error("Profile Setup Error:", error.message)
    if (error.code === '23505') return { error: 'That username is already taken.' }
    return { error: 'Could not save profile. Please try again.' }
  }

  // Award XP for profile creation (only for new profiles)
  if (isNewProfile) {
    try {
      await supabase.rpc('add_xp', {
        p_user_id: user.id,
        p_amount: 100,
        p_reason: 'Welcome to Say! 🎉',
        p_metadata: { action: 'profile_created', username }
      })
    } catch (xpError) {
      // Don't fail profile creation if XP award fails
      console.error("XP Award Error:", xpError)
    }
  }

  // Clear cache for the dashboard
  revalidatePath('/', 'layout') 
  revalidatePath('/dashboard')
  
  return { success: true }       
    }
    
