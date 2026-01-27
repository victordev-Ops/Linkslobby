'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

    // Basic validation for slug (alphanumeric and dashes only)
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
            if (error.code === '23505') { // Unique violation
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
