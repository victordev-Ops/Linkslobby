'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Auth session missing' }

  let slug = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  if (!slug) return { error: 'Username invalid. Please use letters or numbers.' }

  // Check Availability
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('slug', slug)
    .neq('id', user.id)
    .maybeSingle()

  if (existingProfile) {
    return { error: 'This username is already taken. Please choose another.' }
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email!,
      username,
      slug,
    }, { onConflict: 'id' })

  if (error) {
    if (error.code === '23505') return { error: 'This username is already taken.' }
    return { error: 'Could not create profile. Please try again.' }
  }

  revalidatePath('/')
  redirect('/') // Redirect stays as is, Next.js handles this specifically
}
