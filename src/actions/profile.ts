'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    XP_REWARDS,
    applyProRewardMultiplier,
    formatRewardReason,
} from '@/hooks/xp'

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
        .select('id, is_pro')
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
            ...(isNewProfile && { xp_balance: 0 }),
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'id'
        })

    if (error) {
        console.error("Profile Setup Error:", error.message)
        if (error.code === '23505') return { error: 'That username is already taken.' }
        return { error: 'Could not save profile. Please try again.' }
    }

    let xpAwarded: number | undefined
    if (isNewProfile) {
        try {
            const isPro = existingProfile?.is_pro ?? false
            const amount = applyProRewardMultiplier(XP_REWARDS.PROFILE_CREATED, isPro)
            const reason = formatRewardReason('Welcome to Say! 🎉', isPro)

            await supabase.rpc('add_xp', {
                p_user_id: user.id,
                p_amount: amount,
                p_reason: reason,
                p_metadata: { action: 'profile_created', username }
            })
            xpAwarded = amount
        } catch (xpError) {
            console.error("XP Award Error:", xpError)
        }
    }

    revalidatePath('/', 'layout')
    revalidatePath('/dashboard')

    return { success: true, xpAwarded }
}

export async function updateProfile(state: any, formData: FormData) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'You must be logged in to update your profile.' }
    }

    const username = formData.get('username') as string
    const slug = formData.get('slug') as string

    if (!username || username.trim().length < 2) {
        return { error: 'Username must be at least 2 characters long.' }
    }

    if (!slug || slug.trim().length < 2) {
        return { error: 'Slug must be at least 2 characters long.' }
    }

    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
        return { error: 'Slug can only contain lowercase letters, numbers, and dashes.' }
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ username, slug, updated_at: new Date().toISOString() })
            .eq('id', user.id)

        if (error) {
            if (error.code === '23505') {
                return { error: 'This slug is already taken. Please choose another one.' }
            }
            throw error
        }

        revalidatePath('/profile')
        revalidatePath('/settings')

        return { success: 'Profile updated successfully!' }
    } catch (error) {
        console.error('Profile Update Error:', error)
        return { error: 'An unexpected error occurred. Please try again.' }
    }
}

export async function checkSlugAvailability(slug: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { available: false, error: 'Unauthorized' }

    if (!slug || slug.length < 2) return { available: false, message: 'Too short' }
    if (!/^[a-z0-9-]+$/.test(slug)) return { available: false, message: 'Invalid characters' }

    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', slug)
        .neq('id', user.id)
        .single()

    if (data) {
        return { available: false, message: 'Taken' }
    }

    return { available: true }
}

export async function updateRestrictedWords(words: string[]) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Sanitize: lowercase, trim, deduplicate, max 50 words
    const cleaned = [...new Set(words.map(w => w.toLowerCase().trim()).filter(w => w.length > 0))].slice(0, 50)

    const { error } = await supabase
        .from('profiles')
        .update({ restricted_words: cleaned })
        .eq('id', user.id)

    if (error) {
        console.error('updateRestrictedWords error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true, words: cleaned }
}

