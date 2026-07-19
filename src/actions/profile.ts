'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'
import {
    XP_REWARDS,
    applyRewardMultiplier,
    formatRewardReason,
    isBonusActive
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
 *
 * `username` is a display name — spaces are fine, it's not unique.
 * `slug` is the URL-safe handle — this is the field with the unique
 * constraint, so it gets the strict validation. The setup page auto-derives
 * a slug from the username as a starting point, but the user can hand-edit
 * it, so the two are validated and trusted independently here rather than
 * re-deriving slug from username server-side (that would silently discard
 * any manual edit).
 */
export async function setupProfile(username: string, slug: string) {
    const supabase = await createSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { error: 'Session expired. Please sign in again.' }
    }

    // Server-side validation — never trust the client.
    // Collapse repeated internal whitespace and trim; single spaces between
    // words are allowed since this is just a display name.
    const trimmedUsername = username.trim().replace(/\s+/g, ' ')
    if (!trimmedUsername || trimmedUsername.length < 3) {
        return { error: 'Username must be at least 3 characters.' }
    }
    if (trimmedUsername.length > 30) {
        return { error: 'Username must be at most 30 characters.' }
    }
    if (!/^[a-zA-Z0-9_\- ]+$/.test(trimmedUsername)) {
        return { error: 'Username can only contain letters, numbers, spaces, hyphens, and underscores.' }
    }

    const trimmedSlug = slug.trim().toLowerCase()
    if (!trimmedSlug || trimmedSlug.length < 3) {
        return { error: 'Handle must be at least 3 characters.' }
    }
    if (trimmedSlug.length > 30) {
        return { error: 'Handle must be at most 30 characters.' }
    }
    // Slug is what shows up in URLs, so it stays strict: lowercase
    // letters/numbers/hyphens only, no spaces, no leading/trailing/double
    // hyphens.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmedSlug)) {
        return { error: 'Handle can only contain lowercase letters, numbers, and single hyphens between words.' }
    }

    // Determine if first setup
    const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('username, is_pro, bonus_2x_started_at')
        .eq('id', user.id)
        .maybeSingle() // Kept maybeSingle to correctly determine first-time setup

    if (existingProfileError) {
        console.error("Error fetching existing profile:", existingProfileError.message)
        return { error: 'Could not retrieve profile information. Please try again.' }
    }

    const isFirstTimeSetup = !existingProfile || !existingProfile.username

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            email: user.email,
            username: trimmedUsername,
            slug: trimmedSlug,
            ...(isFirstTimeSetup && { xp_balance: 0 }),
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'id'
        })

    if (error) {
        console.error("Profile Setup Error:", error.message)
        if (error.code === '23505') return { error: 'That handle is already taken. Please try another.' }
        return { error: 'Could not save profile. Please try again.' }
    }

    let xpAwarded: number | undefined
    if (isFirstTimeSetup) {
        try {
            const isPro = existingProfile?.is_pro ?? false
            const hasBonus = isBonusActive(existingProfile?.bonus_2x_started_at)
            const amount = applyRewardMultiplier(XP_REWARDS.PROFILE_CREATED, isPro, hasBonus)
            const reason = formatRewardReason('Welcome to Linkslobby! 🎉', isPro, hasBonus)

            await supabase.rpc('add_xp', {
                p_user_id: user.id,
                p_amount: amount,
                p_reason: reason,
                p_metadata: { action: 'profile_created', username: trimmedUsername }
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

/**
 * Optimized profile fetcher using React.cache
 */
export const getProfile = cache(async () => {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return profile
})

export async function updateProfile(state: any, formData: FormData) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'You must be logged in to update your profile.' }
    }

    const username = formData.get('username') as string
    const slug = formData.get('slug') as string
    const dms_disabled = formData.get('dms_disabled') === 'on'

    // formData.get() returns null for a missing field (never undefined), so we
    // must check field *presence* with .has() to know whether the caller intended
    // to update this field at all — otherwise an avatar-only upload would silently
    // null out the cover photo (and vice versa).
    const hasAvatarField = formData.has('avatar_url')
    const hasCoverField = formData.has('cover_url')
    const avatar_url = formData.get('avatar_url') as string | null
    const cover_url = formData.get('cover_url') as string | null

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
            .update({
                username,
                slug,
                dms_disabled,
                ...(hasAvatarField && { avatar_url }),
                ...(hasCoverField && { cover_url }),
                updated_at: new Date().toISOString()
            })
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

export async function updateWatermarkSetting(enabled: boolean) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { error } = await supabase
        .from('profiles')
        .update({ show_watermark: enabled })
        .eq('id', user.id)

    if (error) {
        console.error('updateWatermarkSetting error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true, enabled }
}

export async function updateBio(bio: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const trimmed = bio.trim().slice(0, 160)

    const { error } = await supabase
        .from('profiles')
        .update({ bio: trimmed })
        .eq('id', user.id)

    if (error) {
        console.error('updateBio error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    revalidatePath('/', 'layout')
    return { success: true, bio: trimmed }
}
