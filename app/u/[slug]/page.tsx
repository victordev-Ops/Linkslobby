import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import PublicProfileClient from "./PublicProfileClient"

export const dynamic = 'force-dynamic'

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const supabase = await createSupabaseServerClient()

    // 1. Look up profile by slug
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, slug, avatar_url, is_pro, xp_balance, created_at, bio')
        .eq('slug', slug)
        .single()

    let finalProfile = profile
    if (error || !profile) {
        // Try by username as fallback
        const { data: profileByUsername } = await supabase
            .from('profiles')
            .select('id, username, slug, avatar_url, is_pro, xp_balance, created_at, bio')
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
    
    let friendshipStatus: 'none' | 'pending' | 'accepted' = 'none'
    let viewerIsPro = false

    if (user && !isOwnProfile) {
        // Check friendship status
        const { data: friendship } = await supabase
            .from('friendships')
            .select('status')
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${finalProfile.id}),and(requester_id.eq.${finalProfile.id},addressee_id.eq.${user.id})`)
            .maybeSingle()
        
        if (friendship) {
            friendshipStatus = friendship.status as 'pending' | 'accepted'
        }

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
            viewerIsPro={viewerIsPro}
        />
    )
}
