'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function checkUsernameAvailability(username: string) {
  const supabase = await createSupabaseServerClient()
  
  // Create a URL-friendly slug
  const slug = username.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (slug.length < 3) return { available: false, suggestions: [] }

  const { data } = await supabase
    .from('profiles')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return { available: true, slug, suggestions: [] }

  // Generate alternatives if taken
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

  // Update the row created by your DB trigger
  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      slug,
    })
    .eq('id', user.id)

  if (error) {
    console.error("Update error:", error)
    return { error: 'This username might be taken. Try another.' }
  }

  revalidatePath('/', 'layout') 
  redirect('/dashboard')       
    }
    
