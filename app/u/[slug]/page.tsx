import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import PublicProfileClient from "./PublicProfileClient"

export const dynamic = 'force-dynamic'

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const supabase = await createSupabaseServerClient()

    // Look up profile by slug
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, slug, avatar_url, is_pro, xp_balance, created_at')
        .eq('slug', slug)
        .single()

    if (error || !profile) {
        // Try by username as fallback
        const { data: profileByUsername } = await supabase
            .from('profiles')
            .select('id, username, slug, avatar_url, is_pro, xp_balance, created_at')
            .eq('username', slug)
            .single()

        if (!profileByUsername) {
            notFound()
        }

        return <PublicProfileClient profile={profileByUsername} />
    }

    return <PublicProfileClient profile={profile} />
}
