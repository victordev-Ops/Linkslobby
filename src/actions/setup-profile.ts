'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
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
  console.log("--- SETUP PROFILE START ---")
  const supabase = await createSupabaseServerClient()
  
  // 1. Check Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    console.error("Setup Error: No User Found", authError)
    return { error: 'Session expired. Please sign in again.' }
  }

  console.log("User found:", user.id)

  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // 2. Perform Upsert
  const { error, data } = await supabase
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
    .select() // Add select to ensure we get data back if successful

  if (error) {
    console.error("SUPABASE WRITE ERROR:", error)
    if (error.code === '23505') return { error: 'That username is already taken.' }
    // 42501 is the code for RLS Permission Denied
    if (error.code === '42501') return { error: 'Database permission denied. Check RLS policies.' }
    return { error: `Error saving profile: ${error.message}` }
  }

  console.log("Profile created successfully:", data)

  // 3. Revalidate
  revalidatePath('/', 'layout') 
  revalidatePath('/dashboard')
  
  return { success: true }       
    }
    
