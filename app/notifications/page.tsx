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

    // Fetch confessions (confessions, ama, anonymous)
    const confessionsPromise = supabase
        .from("confessions")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })

    // Fetch DYKM scores
    const dykmScoresPromise = supabase
        .from("dykm_scores")
        .select("*")
        .eq("quiz_owner_id", user.id)
        .order("created_at", { ascending: false })

    // Fetch Lobby Events (for simplicity, we'll fetch messages from lobbies the user is in)
    // This is a bit complex as we need lobbies where user is a participant.
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
            .order("created_at", { ascending: false })
            .limit(20)

        lobbyEvents = events || []
    }

    return (
        <NotificationsClient
            initialConfessions={confessionsRes.data || []}
            initialDykmScores={dykmRes.data || []}
            initialLobbyEvents={lobbyEvents}
            isPro={profileRes.data?.is_pro || false}
            username={profileRes.data?.username || ""}
        />
    )
}
