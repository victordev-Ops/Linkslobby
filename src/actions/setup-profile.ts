// src/actions/setup-profile.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Auth session missing')
  }

  // 1. Generate slug logic
  let baseSlug = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  if (!baseSlug) baseSlug = `user-${user.id.slice(0, 4)}`

  let slug = baseSlug
  let i = 0

  // 2. Conflict resolution for slugs
  while (i < 10) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!data) break
    i++
    slug = `${baseSlug}-${i}`
  }

  // 3. Insert the profile
  const { error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email!,
      username,
      slug,
    })

  if (error) {
    console.error('Error creating profile:', error.message)
    throw new Error('Could not create profile. Try a different username.')
  }

  // 4. Redirect to home page
  // This must be called outside of a try/catch if you add one later
  redirect('/')
    }
              
