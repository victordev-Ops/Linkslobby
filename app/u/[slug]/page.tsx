import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import PublicProfileClient from "./PublicProfileClient"
import { getFriendshipStatus } from "@/actions/friends"

export const dynamic = 'force-dynamic'

const PROFILE_COLUMNS = 'id, username, slug, avatar_url, cover_url, is_pro, xp_balance, created_at, bio'

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const supabase = await createSupabaseServerClient()

    // 1. Look up profile by slug
    const { data: profile, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('slug', slug)
        .single()

    let finalProfile = profile
    if (error || !profile) {
        // Try by username as fallback
        const { data: profileByUsername } = await supabase
            .from('profiles')
            .select(PROFILE_COLUMNS)
            .eq('username', slug)
            .single()

        if (!profileByUsername) {
            notFound()
        }
        finalProfile = profileByUsername
    }

    // 2. Determine viewer state
    const { data: { user } } = await supabase.auth.getUser()
    const isOwnProfile = user?.id === finalProfile.id

    let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none'
    let friendshipId: string | undefined = undefined
    let viewerIsPro = false

    if (user && !isOwnProfile) {
        // Check friendship status (also tells us who sent the request)
        const friendship = await getFriendshipStatus(finalProfile.id)
        friendshipStatus = friendship.status
        friendshipId = friendship.friendshipId

        // Check viewer pro status for CTA
        const { data: viewerProfile } = await supabase
            .from('profiles')
            .select('is_pro')
            .eq('id', user.id)
            .single()

        viewerIsPro = !!viewerProfile?.is_pro
    } else if (isOwnProfile) {
        viewerIsPro = !!finalProfile.is_pro
    }

    return (
        <PublicProfileClient
            profile={finalProfile}
            isOwnProfile={isOwnProfile}
            initialBio={finalProfile.bio || ''}
            friendshipStatus={friendshipStatus}
            friendshipId={friendshipId}
            viewerIsPro={viewerIsPro}
        />
    )
}
