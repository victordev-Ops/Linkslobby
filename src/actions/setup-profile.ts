// src/actions/setup-profile.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function setupProfile(username: string) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Auth session missing')
  }

  // Generate slug
  let baseSlug = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  if (!baseSlug) baseSlug = `user-${user.id.slice(0, 4)}`

  let slug = baseSlug
  let i = 0

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

  const { error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email!,
      username,
      slug,
    })

  if (error) throw error
    }
