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

    // Fetch hidden notifications for the user.
    // IMPORTANT: keyed by "${notification_type}:${notification_id}", not just id.
    // notification_id alone is not safe to dedupe on across tables — a UUID from
    // a hidden confession could theoretically collide with a game_invites row,
    // silently hiding an unrelated notification. hideNotification() in
    // notifications.ts stores the *source table* name (see typeMap there), so we
    // mirror that mapping here to build matching keys.
    const { data: hiddenData } = await supabase
        .from("hidden_notifications")
        .select("notification_id, notification_type")
        .eq("user_id", user.id)

    const hiddenKeys = new Set(
        (hiddenData || []).map(h => `${h.notification_type}:${h.notification_id}`)
    )
    const isHidden = (id: string, dbType: string) => hiddenKeys.has(`${dbType}:${id}`)

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

    // Fetch Hot Seat Questions for sessions hosted by user (host view — new questions)
    const hotSeatPromise = supabase
        .from("hot_seat_questions")
        .select("*, session:hot_seat_sessions!inner(host_id, name, slug)")
        .eq("session.host_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

    // Three Word Game responses (host view)
    const threeWordPromise = supabase
        .from("three_word_responses")
        .select("*")
        .eq("host_id", user.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(50)

    // NEW: Lobby turn events (own is_read column, no notification_reads needed)
    const turnEventsPromise = supabase
        .from("tod_turn_events")
        .select("*, lobby:tod_lobbies(name, slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

    // NEW: Incoming friend requests (pending)
    const friendRequestsPromise = supabase
        .from("friendships")
        .select("*, profile:profiles!friendships_requester_id_fkey(username, slug, avatar_url)")
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50)

    // NEW: Friend request responses (I'm requester, accepted — declines are deleted, unobservable)
    const friendResponsesPromise = supabase
        .from("friendships")
        .select("*, profile:profiles!friendships_addressee_id_fkey(username, slug, avatar_url)")
        .eq("requester_id", user.id)
        .eq("status", "accepted")
        .order("updated_at", { ascending: false })
        .limit(50)

    // NEW: Lobby join responses (my participant status rejected/banned)
    const lobbyJoinResponsesPromise = supabase
        .from("tod_participants")
        .select("*, lobby:tod_lobbies(name, slug)")
        .eq("user_id", user.id)
        .in("status", ["rejected", "banned"])
        .order("joined_at", { ascending: false })
        .limit(50)

    // NEW: Hot Seat answers (I'm asker, my question got resolved)
    const hotSeatAnswersPromise = supabase
        .from("hot_seat_questions")
        .select("*, session:hot_seat_sessions(name, slug)")
        .eq("asker_id", user.id)
        .in("status", ["answered", "skipped", "timed_out"])
        .order("created_at", { ascending: false })
        .limit(50)

    // NEW: Game invites (dedicated table, own is_read column)
    const gameInvitesPromise = supabase
        .from("game_invites")
        .select("*, inviter:profiles!game_invites_inviter_id_fkey(username, slug, avatar_url)")
        .eq("invitee_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

    // Fetch my read statuses for ALL notification_reads-backed types (was lobby_event-only)
    const readStatusPromise = supabase
        .from("notification_reads")
        .select("notification_id, notification_type")
        .eq("user_id", user.id)

    const [
        confessionsRes, dykmRes, lobbiesRes, profileRes, xpRes, hotSeatRes, readStatusRes,
        turnEventsRes, friendRequestsRes, friendResponsesRes, lobbyJoinResponsesRes, hotSeatAnswersRes,
        gameInvitesRes, threeWordRes
    ] = await Promise.all([
        confessionsPromise,
        dykmScoresPromise,
        lobbiesPromise,
        supabase.from("profiles").select("is_pro, username").eq("id", user.id).single(),
        xpPromise,
        hotSeatPromise,
        readStatusPromise,
        turnEventsPromise,
        friendRequestsPromise,
        friendResponsesPromise,
        lobbyJoinResponsesPromise,
        hotSeatAnswersPromise,
        gameInvitesPromise,
        threeWordPromise,
    ])

    // Build the full "${type}:${id}" read-key set once, used by:
    // (a) the legacy lobby_event read-filtering below, and
    // (b) initialReadIds passed straight to the client for the 4 new notification_reads types.
    const allReadKeys = (readStatusRes.data || []).map(r => `${r.notification_type}:${r.notification_id}`)
    const readLobbyIds = new Set(
        (readStatusRes.data || [])
            .filter(r => r.notification_type === "lobby_event" || r.notification_type === "lobby")
            .map(r => r.notification_id)
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

        // Filter out hidden notifications (only applies to hideable types — the 4 new
    // notification_reads types were never added to hidden_notifications, see isHideable()
    // in the client, so no filtering needed for them here)
    const confessions = (confessionsRes.data || []).filter(c => !isHidden(c.id, 'confession'))
    const dykmScores = (dykmRes.data || []).filter(s => !isHidden(s.id, 'dykm_score'))
    // NOTE: 'lobby_event', not 'lobby' — hidden_notifications' check constraint
    // only allows 'lobby_event' (matches the 104 existing rows using that value
    // and deleteNotification()'s NOTIFICATION_TYPE_KEY mapping for 'lobby').
    // This used to say 'lobby', which meant hidden lobby events could never
    // actually be filtered out here even on the rare row that got past the
    // constraint, since the keys never matched.
    const filteredLobbyEvents = lobbyEvents.filter(e => !isHidden(e.id, 'lobby_event'))
    const xpTransactions = (xpRes.data || []).filter(x => !isHidden(x.id, 'xp_transaction'))
    const hotSeatQuestions = (hotSeatRes.data || []).filter(q => !isHidden(q.id, 'hot_seat_question'))
    const turnEvents = (turnEventsRes.data || []).filter(t => !isHidden(t.id, 'tod_turn_event'))
    const gameInvites = (gameInvitesRes.data || []).filter(i => !isHidden(i.id, 'game_invite'))
    const threeWordResponses = (threeWordRes.data || []).filter(r => !isHidden(r.id, 'three_word_response'))
    
    // NEW: Filter out hidden friend requests and responses so they don't reappear on reload
    const friendRequests = (friendRequestsRes.data || []).filter(f => !isHidden(f.id, 'friend_request'))
    const friendResponses = (friendResponsesRes.data || []).filter(f => !isHidden(f.id, 'friend_request_response'))

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
            initialLobbyJoinResponses={lobbyJoinResponsesRes.data || []}
            initialHotSeatAnswers={hotSeatAnswersRes.data || []}
            initialGameInvites={gameInvites}
            initialThreeWordResponses={threeWordResponses}
            initialReadIds={allReadKeys}
            isPro={profileRes.data?.is_pro || false}
            username={profileRes.data?.username || ""}
            profileId={user.id}
        />
    )
}
