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

    // Fetch XP Transactions
    const xpPromise = supabase
        .from("xp_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

    // Fetch lobbies where user is a participant
    const lobbiesPromise = supabase
        .from("tod_participants")
        .select("lobby_id")
        .eq("user_id", user.id)
        .eq("status", "joined")

    // Fetch Hot Seat Questions for sessions hosted by user
    const hotSeatPromise = supabase
        .from("hot_seat_questions")
        .select("*, session:hot_seat_sessions!inner(host_id, name, slug)")
        .eq("session.host_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

    // Fetch my read statuses for shared notifications
    const readStatusPromise = supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", user.id)
        .eq("notification_type", "lobby_event")

    const [confessionsRes, dykmRes, lobbiesRes, profileRes, xpRes, hotSeatRes, readStatusRes] = await Promise.all([
        confessionsPromise,
        dykmScoresPromise,
        lobbiesPromise,
        supabase.from("profiles").select("is_pro, username").eq("id", user.id).single(),
        xpPromise,
        hotSeatPromise,
        readStatusPromise
    ])

    const readLobbyIds = new Set((readStatusRes.data || []).map(r => r.notification_id))

    let lobbyEvents: any[] = []
    if (lobbiesRes.data && lobbiesRes.data.length > 0) {
        const lobbyIds = lobbiesRes.data.map(l => l.lobby_id)
        const { data: events } = await supabase
            .from("tod_messages")
            .select("*, profiles(username), tod_lobbies(status, name)")
            .in("lobby_id", lobbyIds)
            .eq("message_type", "system")
            .order("created_at", { ascending: false })
            .limit(50)

        lobbyEvents = (events || []).map(e => ({
            ...e,
            is_read: readLobbyIds.has(e.id)
        }))
    }

    // Filter out hidden notifications
    const confessions = (confessionsRes.data || []).filter(c => !hiddenIds.has(c.id))
    const dykmScores = (dykmRes.data || []).filter(s => !hiddenIds.has(s.id))
    const filteredLobbyEvents = lobbyEvents.filter(e => !hiddenIds.has(e.id))
    const xpTransactions = (xpRes.data || []).filter(x => !hiddenIds.has(x.id))
    const hotSeatQuestions = (hotSeatRes.data || []).filter(q => !hiddenIds.has(q.id))

    console.log('--- Debug Notifications Server ---')
    console.log('User ID:', user.id)
    console.log('Hidden IDs found:', hiddenIds.size, Array.from(hiddenIds))
    console.log('Confessions (raw/filtered):', (confessionsRes.data || []).length, confessions.length)
    if (hiddenIds.size > 0 && (confessionsRes.data || []).length > 0) {
        console.log('First Raw Confession ID:', confessionsRes.data?.[0].id)
        console.log('Is it in hiddenIds?:', hiddenIds.has(confessionsRes.data?.[0].id))
    }
    console.log('Lobby Events (raw/filtered):', lobbyEvents.length, filteredLobbyEvents.length)
    console.log('XP Transactions (raw/filtered):', (xpRes.data || []).length, xpTransactions.length)
    console.log('Hot Seat Questions (raw/filtered):', (hotSeatRes.data || []).length, hotSeatQuestions.length)
    console.log('---------------------------')

    return (
        <NotificationsClient
            initialConfessions={confessions}
            initialDykmScores={dykmScores}
            initialLobbyEvents={filteredLobbyEvents}
            initialXpTransactions={xpTransactions}
            initialHotSeatQuestions={hotSeatQuestions}
            isPro={profileRes.data?.is_pro || false}
            username={profileRes.data?.username || ""}
            profileId={user.id}
        />
    )
}
