import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import NotificationsClient from "./NotificationsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function NotificationsPage() {
    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Fetch hidden notifications for the user
    const { data: hiddenData } = await supabase
        .from("hidden_notifications")
        .select("notification_id")
        .eq("user_id", user.id)

    const hiddenIds = new Set((hiddenData || []).map(h => h.notification_id))

    // Fetch confessions (confessions, ama, anonymous)
    // Note: We used to filter by .eq("is_hidden", false) but now we use the separate table
    // However, we still respect the local is_hidden if it was used for admin/soft-delete purposes
    const confessionsPromise = supabase
        .from("confessions")
        .select("*")
        .eq("profile_id", user.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })

    // Fetch DYKM scores
    const dykmScoresPromise = supabase
        .from("dykm_scores")
        .select("*")
        .eq("quiz_owner_id", user.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })

    // Fetch Lobby Events
    const lobbiesPromise = supabase
        .from("tod_participants")
        .select("lobby_id")
        .eq("user_id", user.id)

    const [confessionsRes, dykmRes, lobbiesRes, profileRes] = await Promise.all([
        confessionsPromise,
        dykmScoresPromise,
        lobbiesPromise,
        supabase.from("profiles").select("is_pro, username").eq("id", user.id).single()
    ])

    let lobbyEvents: any[] = []
    if (lobbiesRes.data && lobbiesRes.data.length > 0) {
        const lobbyIds = lobbiesRes.data.map(l => l.lobby_id)
        const { data: events } = await supabase
            .from("tod_messages")
            .select("*, profiles(username), tod_lobbies(status)")
            .in("lobby_id", lobbyIds)
            .eq("message_type", "system")
            // .eq("is_hidden", false) // tod_messages might not have is_hidden or it might be shared. We rely on hidden_notifications table.
            .order("created_at", { ascending: false })
            .limit(50) // Increased limit to account for filtered items

        lobbyEvents = events || []
    }

    // Filter out hidden notifications
    const confessions = (confessionsRes.data || []).filter(c => !hiddenIds.has(c.id))
    const dykmScores = (dykmRes.data || []).filter(s => !hiddenIds.has(s.id))
    const filteredLobbyEvents = lobbyEvents.filter(e => !hiddenIds.has(e.id))

    return (
        <NotificationsClient
            initialConfessions={confessions}
            initialDykmScores={dykmScores}
            initialLobbyEvents={filteredLobbyEvents}
            isPro={profileRes.data?.is_pro || false}
            username={profileRes.data?.username || ""}
            profileId={user.id}
        />
    )
}
