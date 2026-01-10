//src/actions/setup-profile.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Note: 'redirect' is removed from imports to prevent server-side navigation issues

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

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,          
      email: user.email,    
      username: username,
      slug: slug,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'      
    })

  if (error) {
    console.error("Profile Setup Error:", error)
    if (error.code === '23505') return { error: 'That username is already taken.' }
    return { error: 'Could not save profile. Please try again.' }
  }

  // 1. Clear the Next.js Cache
  revalidatePath('/', 'layout') 
  revalidatePath('/dashboard')
  
  // 2. Return success instead of redirecting
  // This allows the client to refresh the AuthContext before navigating
  return { success: true }       
                                  }
