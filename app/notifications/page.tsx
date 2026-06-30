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

    // Fetch lobby turn events for the user
    const turnEventsPromise = supabase
        .from("tod_turn_events")
        .select("*, lobby:tod_lobbies(name, slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

    // Fetch incoming pending friend requests
    const friendRequestsPromise = supabase
        .from("friendships")
        .select("*, profile:profiles!friendships_requester_id_fkey(username, slug, avatar_url)")
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

    // Fetch friend requests I sent that were accepted
    const friendResponsesPromise = supabase
        .from("friendships")
        .select("*, profile:profiles!friendships_addressee_id_fkey(username, slug, avatar_url)")
        .eq("requester_id", user.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })

    // Fetch lobby join requests of mine that were rejected/banned
    const lobbyJoinResponsesPromise = supabase
        .from("tod_participants")
        .select("*, lobby:tod_lobbies(name, slug)")
        .eq("user_id", user.id)
        .in("status", ["rejected", "banned"])
        .order("created_at", { ascending: false })

    // Fetch my Hot Seat questions that were resolved (answered/skipped/timed_out)
    const hotSeatAnswersPromise = supabase
        .from("hot_seat_questions")
        .select("*, session:hot_seat_sessions(name, slug)")
        .eq("asker_id", user.id)
        .in("status", ["answered", "skipped", "timed_out"])
        .order("created_at", { ascending: false })
        .limit(50)

    // Fetch my read statuses for notification_reads-backed notification types
    const readStatusPromise = supabase
        .from("notification_reads")
        .select("notification_id, notification_type")
        .eq("user_id", user.id)
        .in("notification_type", [
            "lobby_event",
            "tod_turn",
            "friend_request",
            "friend_request_response",
            "lobby_join_response",
            "hot_seat_answer"
        ])

    const [
        confessionsRes,
        dykmRes,
        lobbiesRes,
        profileRes,
        xpRes,
        hotSeatRes,
        turnEventsRes,
        friendRequestsRes,
        friendResponsesRes,
        lobbyJoinResponsesRes,
        hotSeatAnswersRes,
        readStatusRes
    ] = await Promise.all([
        confessionsPromise,
        dykmScoresPromise,
        lobbiesPromise,
        supabase.from("profiles").select("is_pro, username").eq("id", user.id).single(),
        xpPromise,
        hotSeatPromise,
        turnEventsPromise,
        friendRequestsPromise,
        friendResponsesPromise,
        lobbyJoinResponsesPromise,
        hotSeatAnswersPromise,
        readStatusPromise
    ])

    const readLobbyIds = new Set(
        (readStatusRes.data || [])
            .filter(r => r.notification_type === "lobby_event")
            .map(r => r.notification_id)
    )

    // Pre-computed "${notification_type}:${notification_id}" keys for notification_reads-backed types
    const initialReadIds = (readStatusRes.data || []).map(
        r => `${r.notification_type}:${r.notification_id}`
    )

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
    const turnEvents = (turnEventsRes.data || []).filter(t => !hiddenIds.has(t.id))
    // friend_request, friend_request_response, lobby_join_response, hot_seat_answer are not hideable
    const friendRequests = friendRequestsRes.data || []
    const friendResponses = friendResponsesRes.data || []
    const lobbyJoinResponses = lobbyJoinResponsesRes.data || []
    const hotSeatAnswers = hotSeatAnswersRes.data || []

    return (
        <NotificationsClient
            initialConfessions={confessions}
            initialDykmScores={dykmScores}
            initialLobbyEvents={filteredLobbyEvents}
            initialXpTransactions={xpTransactions}
            initialHotSeatQuestions={hotSeatQuestions}
            initialTurnEvents={turnEvents}
            initialFriendRequests={friendRequests}
            initialFriendResponses={friendResponses}
            initialLobbyJoinResponses={lobbyJoinResponses}
            initialHotSeatAnswers={hotSeatAnswers}
            initialReadIds={initialReadIds}
            isPro={profileRes.data?.is_pro || false}
            username={profileRes.data?.username || ""}
            profileId={user.id}
        />
    )
            }
