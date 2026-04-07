import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ProfileClient from "./ProfileClient"
import { getProfile } from "@/actions/profile"
import { getFriends, getPendingRequests, getSuggestedFriends, getSentRequests } from "@/actions/friends"

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const [profile, friends, pendingRequests, suggestedFriends, sentRequests] = await Promise.all([
        getProfile(),
        getFriends(),
        getPendingRequests(),
        getSuggestedFriends(),
        getSentRequests(),
    ])

    if (!profile) {
        // Handle edge case where auth user exists but profile doesn't
        return <div>Profile not found. Please contact support.</div>
    }

    return (
        <ProfileClient
            user={user}
            profile={{
                username: profile.username || '',
                slug: profile.slug || '',
                email: profile.email || user.email, // Fallback to auth email
                avatar_url: profile.avatar_url,
                dms_disabled: profile.dms_disabled || false,
                is_pro: profile.is_pro || false,
                bio: profile.bio || ''
            }}
            initialFriends={friends}
            initialPendingRequests={pendingRequests}
            initialSuggestedFriends={suggestedFriends}
            initialSentRequests={sentRequests}
        />
    )
}

