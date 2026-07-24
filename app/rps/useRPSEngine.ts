import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner" // still needed for toast.dismiss("disconnect-toast")
import { showAppToast, showAppSuccess, showAppError } from "@/components/AppToast"
import { Bot, Trophy, AlertTriangle, Gamepad2, RefreshCw, Lock, Undo2 } from "lucide-react"
import {
    createRPSMatch,
    joinRPSMatch,
    peekRPSRoom,
    submitRPSMove,
    cancelRPSMatch,
    getActiveRPSMatch,
    getRPSBalance,
    triggerAITakeover,
    reconnectToMatch,
    getPlayerRPSHistory,
    type RPSMatch,
    type RPSMove,
    type RPSActionResult,
    type RPSMatchHistoryItem,
    type RPSRoomPreview,
} from "@/actions/rps"

export type GamePhase = "choosing" | "waiting" | "countdown" | "reveal" | "matchEnd"

export interface RoundHistory {
    round: number
    playerChoice: RPSMove
    opponentChoice: RPSMove
    result: "win" | "lose" | "tie"
}

// ═══════════════════════════════════════════════════════════════
// DISCONNECT HANDLING CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DISCONNECT_TIMEOUT_SECONDS = 15  // Seconds before AI takes over
const MAX_DISCONNECTS_BEFORE_FORFEIT = 3  // Auto-forfeit threshold
const MIN_STAKE = 50
const MAX_STAKE = 10000

export function useRPSEngine(profile: { id: string; username: string; slug: string; is_pro: boolean }) {
    const router = useRouter()
    const [supabase] = useState(() => createClient())

    // ─── Match state (server-authoritative) ───
    const [matchId, setMatchId] = useState<string | null>(null)
    const [match, setMatch] = useState<RPSMatch | null>(null)
    const [mode, setMode] = useState<"solo" | "friend" | null>(null)
    const [roomCode, setRoomCode] = useState("")
    const [isPlayerA, setIsPlayerA] = useState(true)

    // ─── UI state ───
    const [phase, setPhase] = useState<GamePhase>("choosing")
    const [playerChoice, setPlayerChoice] = useState<RPSMove | null>(null)
    const [opponentChoice, setOpponentChoice] = useState<RPSMove | null>(null)
    const [playerScore, setPlayerScore] = useState(0)
    const [opponentScore, setOpponentScore] = useState(0)
    const [roundHistory, setRoundHistory] = useState<RoundHistory[]>([])
    const [countdown, setCountdown] = useState(3)
    const [matchResult, setMatchResult] = useState<"won" | "lost" | null>(null)
    const [lastResult, setLastResult] = useState<"win" | "lose" | "tie" | null>(null)
    const [opponentName, setOpponentName] = useState("")

    // ─── Lobby/UX state ───
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [showJoinInput, setShowJoinInput] = useState(false)
    const [joinRoomId, setJoinRoomId] = useState("")
    const [roomPreview, setRoomPreview] = useState<RPSRoomPreview | null>(null)
    const [isPeekingRoom, setIsPeekingRoom] = useState(false)
    const [starBalance, setStarBalance] = useState<number | null>(null)
    const [showBalanceGate, setShowBalanceGate] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isRecovering, setIsRecovering] = useState(true)
    const [pendingMode, setPendingMode] = useState<"solo" | "friend" | null>(null)
    const [stakeAmount, setStakeAmount] = useState(100)
    const [showStakeSelector, setShowStakeSelector] = useState(false)
    const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null)
    const [moveTimeLeft, setMoveTimeLeft] = useState<number | null>(null)
    
    // ─── Match History State ───
    const [showHistory, setShowHistory] = useState(false)
    const [historyData, setHistoryData] = useState<RPSMatchHistoryItem[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    // ─── Refs ───
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
    const phaseRef = useRef<GamePhase>("choosing")
    const lastRoundRef = useRef(0)
    const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
    const disconnectIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const modeRef = useRef<"solo" | "friend" | null>(null)
    const matchRef = useRef<RPSMatch | null>(null)
    const roundVersionRef = useRef(0)
    const scoreHistoryRef = useRef<Record<number, {myScore: number, oppScore: number}>>({
        0: { myScore: 0, oppScore: 0 }
    })
    const pendingScoresRef = useRef<{myScore: number, oppScore: number} | null>(null)
    const opponentJoinedRef = useRef(false)

    useEffect(() => { phaseRef.current = phase }, [phase])
    useEffect(() => { modeRef.current = mode }, [mode])
    useEffect(() => { matchRef.current = match }, [match])

    // ─── aiActive is DERIVED, never independently tracked ───
    // This used to be its own useState, flipped on/off from four separate
    // places (handleMatchUpdate, the presence 'join' handler,
    // triggerImmediateAI, and the mount-recovery effect). Those fired in
    // whatever order the network delivered events in, so a slightly-stale
    // postgres_changes payload could arrive AFTER the presence 'join'
    // handler had already optimistically flipped it false — setting it
    // back to true and leaving the "AI is playing for your opponent"
    // banner stuck even though the opponent had reconnected and
    // match.ai_player was already null on the server. Deriving it
    // directly from `match` gives a single source of truth that can
    // never desync from what the server actually thinks is happening.
    const aiActive = !!match?.ai_player


    // ═══════════════════════════════════════════════════════════════
    // DISCONNECT HANDLING — Presence-based detection
    // ═══════════════════════════════════════════════════════════════

    // Clear all disconnect timers (used on reconnect & cleanup)
    const clearDisconnectTimers = useCallback(() => {
        if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current)
            disconnectTimerRef.current = null
        }
        if (disconnectIntervalRef.current) {
            clearInterval(disconnectIntervalRef.current)
            disconnectIntervalRef.current = null
        }
        setDisconnectCountdown(null)
    }, [])

    // ─── Shared guard: only one AI-takeover RPC in flight at a time ───
    // triggerImmediateAI (manual button), the presence-based disconnect
    // sequence, and the move-deadline enforcement effect can each
    // independently decide — near-simultaneously — that the same player
    // should be defaulted to AI (e.g. someone disconnects with only a
    // couple of seconds left on their move clock, so both the 15s
    // disconnect timer and the 60s deadline timer are racing to fire).
    // Without a shared guard, each path would fire its own
    // triggerAITakeover call concurrently. Routing every call through
    // this wrapper means only the first one actually goes out.
    const aiTakeoverInFlightRef = useRef(false)
    const fireAITakeover = useCallback(async (matchId: string, targetUserId: string): Promise<RPSActionResult> => {
        if (aiTakeoverInFlightRef.current) return { success: false, action: 'already_in_flight' }
        aiTakeoverInFlightRef.current = true
        try {
            return await triggerAITakeover(matchId, targetUserId)
        } finally {
            aiTakeoverInFlightRef.current = false
        }
    }, [])

    // Trigger immediate AI takeover (exposed to UI for "Switch to AI now" button)
    const triggerImmediateAI = useCallback(async () => {
        const currentMatch = matchRef.current
        if (!currentMatch) return
        const leftUserId = currentMatch.player_a === profile.id
            ? currentMatch.player_b
            : currentMatch.player_a
        if (!leftUserId || !currentMatch.id) return

        clearDisconnectTimers()

        const res = await fireAITakeover(currentMatch.id, leftUserId)
        if (res.success && (res.action === 'ai_takeover' || res.action === 'already_ai')) {
            // aiActive flips true on its own once the postgres_changes
            // UPDATE for this RPC's write comes through — no need to set it here.
            showAppToast("AI is stepping in", { id: "disconnect-toast", duration: 4000, icon: Bot, variant: "warning" })
        } else if (res.action === 'auto_forfeit') {
            // Opponent hit 3 disconnects — they auto-forfeit
            showAppToast("Opponent auto-forfeited! You win!", { id: "disconnect-toast", duration: 5000, icon: Trophy, variant: "success" })
        } else if (res.action !== 'already_in_flight') {
            toast.dismiss("disconnect-toast")
        }
    }, [profile.id, clearDisconnectTimers, fireAITakeover])


    // ─── Shared disconnect countdown → AI takeover sequence ───
    // Used both by the live "presence leave" event AND by the initial
    // subscribe check below. Without the latter, a player who reloads
    // (or opens the game) while their opponent is ALREADY gone would
    // never see a "leave" event fire — since that event only fires on
    // a live transition — and the match would hang forever waiting on
    // a move that will never come (the classic "stale state" case).
    const startDisconnectSequence = useCallback((channel: ReturnType<typeof supabase.channel>, mId: string) => {
        if (disconnectTimerRef.current) return // already running

        let secondsLeft = DISCONNECT_TIMEOUT_SECONDS
        setDisconnectCountdown(secondsLeft)
        showAppToast(`Opponent lost connection… waiting ${DISCONNECT_TIMEOUT_SECONDS}s`, {
            icon: AlertTriangle, id: "disconnect-toast", duration: (DISCONNECT_TIMEOUT_SECONDS + 1) * 1000, variant: "warning"
        })

        disconnectIntervalRef.current = setInterval(() => {
            secondsLeft--
            setDisconnectCountdown(secondsLeft)
            if (secondsLeft <= 0 && disconnectIntervalRef.current) {
                clearInterval(disconnectIntervalRef.current)
            }
        }, 1000)

        disconnectTimerRef.current = setTimeout(() => {
            // Re-check presence one final time
            const currentPresence = channel.presenceState()
            const isHereNow = Object.values(currentPresence).flat().some((p: any) => p.user_id !== profile.id)
            if (isHereNow) {
                clearDisconnectTimers()
                return
            }

            // Trigger AI takeover via RPC — the RPC itself is responsible
            // for immediately playing the disconnected player's move for
            // the CURRENT round if it's outstanding, so the round resolves
            // right away instead of sitting stale waiting on a move that
            // will never arrive.
            const currentMatch = matchRef.current
            const leftUserId = currentMatch?.player_a === profile.id
                ? currentMatch?.player_b
                : currentMatch?.player_a
            if (leftUserId && currentMatch) {
                fireAITakeover(mId, leftUserId).then(res => {
                    if (res.success && (res.action === 'ai_takeover' || res.action === 'already_ai')) {
                        showAppToast("AI is stepping in", { id: "disconnect-toast", duration: 4000, icon: Bot, variant: "warning" })
                    } else if (res.action === 'auto_forfeit') {
                        showAppToast("Opponent auto-forfeited! You win!", { id: "disconnect-toast", duration: 5000, icon: Trophy, variant: "success" })
                    } else if (res.action !== 'already_in_flight') {
                        toast.dismiss("disconnect-toast")
                    }
                    setDisconnectCountdown(null)
                })
            }
        }, DISCONNECT_TIMEOUT_SECONDS * 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id, clearDisconnectTimers, fireAITakeover])


    // ═══════════════════════════════════════════════════════════════
    // REALTIME SUBSCRIPTION — Postgres Changes + Presence
    // ═══════════════════════════════════════════════════════════════

    // ─── Shared guard: only one reconnect RPC in flight at a time ───
    // A flaky connection can produce several leave/join presence blips in
    // quick succession before things settle (e.g. opponent's wifi hiccups
    // twice in a row) — each 'join' would otherwise fire its own
    // reconnectToMatch call. This mirrors aiTakeoverInFlightRef above.
    const reconnectInFlightRef = useRef(false)
    const fireReconnect = useCallback(async (matchId: string) => {
        if (reconnectInFlightRef.current) return null
        reconnectInFlightRef.current = true
        try {
            return await reconnectToMatch(matchId)
        } finally {
            reconnectInFlightRef.current = false
        }
    }, [])

    const subscribeToMatch = useCallback((mId: string) => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }

        const channel = supabase
            .channel(`rps-match-${mId}`, { config: { presence: { key: profile.id } } })
            .on("postgres_changes", {
                event: "UPDATE",
                schema: "public",
                table: "rps_matches",
                filter: `id=eq.${mId}`,
            }, (payload) => {
                const updated = payload.new as RPSMatch
                handleMatchUpdate(updated)
            })

            // ─── DISCONNECT DETECTION (presence leave) ───
            // When opponent disappears from presence, start a countdown.
            // After DISCONNECT_TIMEOUT_SECONDS, trigger AI takeover.
            .on("presence", { event: "leave" }, () => {
                if (modeRef.current === "friend") {
                    const state = channel.presenceState()
                    const stillPresent = Object.values(state).flat().some((p: any) => p.user_id !== profile.id)

                    if (!stillPresent) {
                        startDisconnectSequence(channel, mId)
                    }
                }
            })

            // ─── RECONNECTION DETECTION (presence join) ───
            // When opponent comes back, clear timers and call reconnect RPC
            // so AI hands back control (after finishing any in-progress round).
            .on("presence", { event: "join" }, ({ newPresences }) => {
                if (newPresences.some((p: any) => p.user_id !== profile.id)) {
                    clearDisconnectTimers()

                    // If AI was active, tell the server to hand control back.
                    // We deliberately do NOT set any local aiActive/toast state
                    // here — the postgres_changes UPDATE this RPC triggers is
                    // what actually flips `match.ai_player`/`disconnected_player`,
                    // and the dedicated effect below reacts to that (single
                    // source of truth) so this handler and that effect can
                    // never disagree about what the user should see.
                    const currentMatch = matchRef.current
                    if (currentMatch && currentMatch.ai_player && currentMatch.disconnected_player) {
                        fireReconnect(currentMatch.id)
                    } else {
                        showAppToast("Opponent reconnected!", { id: "disconnect-toast", icon: Gamepad2, variant: "success" })
                    }
                }
            })

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: profile.id, online_at: new Date().toISOString() })

                // ─── STALE-STATE GUARD ───
                // We just (re)subscribed — e.g. after a page reload, or after
                // recovering an in-progress match. If the opponent is ALREADY
                // absent at this moment, no "leave" event will ever fire for
                // us (that event only fires on a live presence transition),
                // so without this check the match would hang forever on their
                // move. Check presence immediately and kick off the same
                // disconnect → AI-takeover sequence if they're missing.
                if (modeRef.current === "friend") {
                    const currentMatch = matchRef.current
                    const isActiveFriendMatch = currentMatch?.status === "active" && currentMatch?.mode === "friend"
                    const alreadyOnAI = !!currentMatch?.ai_player
                    if (isActiveFriendMatch && !alreadyOnAI) {
                        const state = channel.presenceState()
                        const stillPresent = Object.values(state).flat().some((p: any) => p.user_id !== profile.id)
                        if (!stillPresent) {
                            startDisconnectSequence(channel, mId)
                        }
                    }
                }
            }
        })

        channelRef.current = channel
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, profile.id, clearDisconnectTimers, startDisconnectSequence, fireReconnect])

    // Cleanup channel on unmount
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
            clearDisconnectTimers()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase])

    const fetchOpponentName = async (userId: string) => {
        const { data } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", userId)
            .single()
        if (data?.username) setOpponentName(data.username)
    }


    // ═══════════════════════════════════════════════════════════════
    // MATCH STATE UPDATE HANDLER
    // ═══════════════════════════════════════════════════════════════

    const handleMatchUpdate = useCallback((updated: RPSMatch) => {
        setMatch(updated)
        const amA = updated.player_a === profile.id
        setIsPlayerA(amA)

        // AI takeover / reconnection state and its toasts are handled by
        // the dedicated effect that watches match.ai_player and
        // match.disconnected_player — see below. Keeping opponentName as
        // the player's clean, unmutated username (never suffixed with
        // "(AI)") means there's nothing here that can get out of sync.

        // ─── Opponent joined (waiting → active) — fire toast ONCE ───
        if (updated.status === "active" && updated.player_b && updated.mode === "friend") {
            if (!opponentName || opponentName === "AI 🤖") {
                const otherId = amA ? updated.player_b : updated.player_a
                if (otherId) fetchOpponentName(otherId)
            }
            if (!opponentJoinedRef.current) {
                opponentJoinedRef.current = true
                // A friend match defaults to the "choosing" phase from the
                // moment it's created (only solo mode sets phase
                // explicitly on create), which means the room creator can
                // lock in a move BEFORE the opponent ever joins. Without
                // this check, receiving the "opponent joined" update would
                // unconditionally snap phase back to "choosing" here —
                // visually unlocking a move the server already has on
                // record for the current round. Re-derive from the
                // server's own move_a/move_b instead of assuming "choosing".
                const myMove = amA ? updated.move_a : updated.move_b
                if (myMove) {
                    setPlayerChoice(myMove as RPSMove)
                    setPhase("waiting")
                } else {
                    setPhase("choosing")
                }
                showAppToast("Opponent joined! Game on!", { duration: 3000, icon: Gamepad2, variant: "success" })
            }
        }

        // ─── DEFERRED SCORE UPDATE ───
        // ONLY update scores if we're NOT in a countdown or reveal phase.
        // Scores MUST only be applied after the 3-second countdown completes.
        // If we're currently in countdown/reveal, defer via pendingScoresRef instead.
        const resolvedRound = updated.current_round - 1
        if (resolvedRound <= lastRoundRef.current && phaseRef.current !== "countdown" && phaseRef.current !== "reveal") {
            const myScore = amA ? updated.score_a : updated.score_b
            const oppScore = amA ? updated.score_b : updated.score_a
            setPlayerScore(myScore)
            setOpponentScore(oppScore)
        }

        // ─── Match completed — set result (scores come after reveal) ───
        if (updated.status === "completed") {
            const hasWon = updated.winner_id === profile.id
            setMatchResult(hasWon ? "won" : "lost")

            // Detect abrupt forfeit (nobody reached the win target)
            const targetWins = Math.ceil((updated.best_of || 5) / 2)
            const myScore = amA ? updated.score_a : updated.score_b
            const oppScore = amA ? updated.score_b : updated.score_a
            
            if (hasWon && myScore < targetWins) {
                showAppToast("Opponent forfeited! You win the full prize!", { duration: 5000, icon: Trophy, variant: "success" })
                setPhase("matchEnd")
            } else if (!hasWon && oppScore < targetWins) {
                // If we lost and they didn't hit the target score, it was a forfeit on our end
                setPhase("matchEnd")
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id, opponentName])


    // ═══════════════════════════════════════════════════════════════
    // AI-STATE MESSAGING — single source of truth
    // Fires toasts purely off transitions in match.ai_player /
    // match.disconnected_player (server truth), instead of the old
    // pattern of three different call sites (postgres_changes handler,
    // presence 'join' handler, mount-recovery) each independently
    // deciding when to say "AI took over" / "opponent's back". Because
    // aiActive itself is now derived (see above), this effect can't
    // leave the UI in a stuck state — it only ever describes what
    // `match` already says is true.
    // ═══════════════════════════════════════════════════════════════
    const prevAiStateRef = useRef<{ aiPlayer: string | null; disconnectedPlayer: string | null }>({
        aiPlayer: null,
        disconnectedPlayer: null,
    })

    useEffect(() => {
        if (!match || mode !== "friend") return
        const prev = prevAiStateRef.current
        const nowAiPlayer = match.ai_player ?? null
        const nowDisconnected = match.disconnected_player ?? null

        // AI just took over (wasn't active before, is now)
        if (nowAiPlayer && !prev.aiPlayer) {
            showAppToast("AI has temporarily taken over for your opponent", { icon: Bot, id: "disconnect-toast", variant: "warning" })
        }

        // Opponent is physically back (disconnected_player cleared) while
        // AI is still finishing the in-flight round — tell the player
        // their opponent is back WITHOUT implying the banner should
        // disappear yet, since AI is still submitting this one move.
        if (nowAiPlayer && !nowDisconnected && prev.disconnectedPlayer) {
            showAppToast("Opponent is back! AI is finishing this round…", { id: "disconnect-toast", icon: Gamepad2, variant: "success" })
        }

        // AI fully cleared — opponent has full control back
        if (!nowAiPlayer && prev.aiPlayer) {
            showAppToast("Opponent is back in control!", { id: "disconnect-toast", icon: Gamepad2, variant: "success" })
        }

        prevAiStateRef.current = { aiPlayer: nowAiPlayer, disconnectedPlayer: nowDisconnected }
    }, [match?.ai_player, match?.disconnected_player, mode])


    // ═══════════════════════════════════════════════════════════════
    // GAME STATE RECOVERY ON MOUNT
    // Handles both fresh load AND reconnection after disconnect.
    // ═══════════════════════════════════════════════════════════════

    useEffect(() => {
        let cancelled = false
        const recover = async () => {
            try {
                const result = await getActiveRPSMatch()
                if (cancelled) return
                if (result.success && result.match) {
                    const m = result.match
                    setMatch(m)
                    setMatchId(m.id)
                    setMode(m.mode)
                    setRoomCode(m.room_code || "")
                    setIsPlayerA(m.player_a === profile.id)
                    setStakeAmount(m.stake_amount)
                    const amA = m.player_a === profile.id
                    setPlayerScore(amA ? m.score_a : m.score_b)
                    setOpponentScore(amA ? m.score_b : m.score_a)
                    lastRoundRef.current = m.current_round - 1
                    roundVersionRef.current = m.round_version || 0
                    scoreHistoryRef.current[m.current_round - 1] = {
                        myScore: amA ? m.score_a : m.score_b,
                        oppScore: amA ? m.score_b : m.score_a,
                    }
                    // Seed the ai-state ref from the recovered match so the
                    // messaging effect doesn't treat "AI was already active
                    // when I loaded the page" as a fresh transition and fire
                    // a toast for something that happened before we arrived.
                    prevAiStateRef.current = {
                        aiPlayer: m.ai_player ?? null,
                        disconnectedPlayer: m.disconnected_player ?? null,
                    }

                    if (m.status === "waiting") {
                        setPhase("choosing")
                    } else if (m.status === "active") {
                        setPhase("choosing")
                        const myMove = m.player_a === profile.id ? m.move_a : m.move_b
                        if (myMove) {
                            setPlayerChoice(myMove as RPSMove)
                            setPhase("waiting")
                        }
                    }

                    subscribeToMatch(m.id)
                    if (m.mode === "friend") {
                        const otherId = m.player_a === profile.id ? m.player_b : m.player_a
                        if (otherId) fetchOpponentName(otherId)
                    }

                    // ─── RECONNECTION: If I was the disconnected player, reclaim control ───
                    if (m.disconnected_player === profile.id) {
                        const reconnResult = await fireReconnect(m.id)
                        if (reconnResult?.success) {
                            if (reconnResult.action === 'reconnected') {
                                showAppToast("Welcome back! You're in control again!", { duration: 4000, icon: Gamepad2, variant: "success" })
                            } else if (reconnResult.action === 'reconnected_round_in_progress') {
                                showAppToast("Welcome back! AI is finishing the current round…", { icon: Bot, duration: 4000, variant: "warning" })
                            }
                        }
                    } else {
                        showAppToast("Game restored from server", { icon: RefreshCw, variant: "info" })
                    }
                }
            } catch (err) {
                console.error("Recovery error:", err)
            } finally {
                if (!cancelled) setIsRecovering(false)
            }
        }
        recover()

        const params = new URLSearchParams(window.location.search)
        const joinCode = params.get("join")
        if (joinCode) {
            setJoinRoomId(joinCode.toUpperCase())
            setShowJoinInput(true)
        }
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])


    // ═══════════════════════════════════════════════════════════════
    // MATCH CREATION & JOINING
    // ═══════════════════════════════════════════════════════════════

    const startMatch = async (matchMode: "solo" | "friend", stake: number) => {
        setIsLoading(true)
        try {
            const result = await createRPSMatch(matchMode, stake)
            if (!result.success) {
                showAppError(result.error || "Failed to create match")
                return
            }
            setMatchId(result.match_id!)
            setMode(matchMode)
            setRoomCode(result.room_code || "")
            setStakeAmount(stake)
            setIsPlayerA(true)
            setPlayerScore(0)
            setOpponentScore(0)
            setRoundHistory([])
            setMatchResult(null)
            lastRoundRef.current = 0
            scoreHistoryRef.current = { 0: { myScore: 0, oppScore: 0 } }
            setStarBalance(result.new_balance ?? null)
            showAppToast(`${stake} Stars locked as escrow`, { icon: Lock, variant: "xp" })

            setMatch({
                id: result.match_id!,
                player_a: profile.id,
                mode: matchMode,
                stake_amount: stake,
                room_code: result.room_code,
                status: matchMode === 'solo' ? 'active' : 'waiting',
                score_a: 0,
                score_b: 0,
                current_round: 1,
                escrow_a: true,
                escrow_b: false,
            } as RPSMatch)

            if (matchMode === "solo") setPhase("choosing")
            subscribeToMatch(result.match_id!)
        } catch {
            showAppError("Failed to create match")
        } finally {
            setIsLoading(false)
        }
    }

    const handleModeSelect = async (selectedMode: "solo" | "friend") => {
        setIsLoading(true)
        try {
            const result = await getRPSBalance()
            const balance = result.success ? result.balance : 0
            setStarBalance(balance)

            if (balance >= MIN_STAKE) {
                setPendingMode(selectedMode)
                setStakeAmount(Math.min(100, balance))
                setShowStakeSelector(true)
            } else {
                setPendingMode(selectedMode)
                setShowBalanceGate(true)
            }
        } catch {
            showAppError("Failed to check balance")
        } finally {
            setIsLoading(false)
        }
    }

    const handleStakeConfirm = async (stake: number) => {
        if (!pendingMode) return
        
        // Validate stake
        if (stake < MIN_STAKE || stake > MAX_STAKE || stake > (starBalance || 0)) {
            showAppError(`Enter a valid amount (${MIN_STAKE}-${MAX_STAKE} Stars)`)
            return
        }
        
        setShowStakeSelector(false)
        await startMatch(pendingMode, stake)
    }

    // ─── Step 1: Peek a room's stake BEFORE joining ──────────────────
    // A friend entering a room code should know what they're staking
    // before any Stars are locked, not find out only after joining.
    const handlePeekRoom = async (code: string) => {
        const trimmed = code.trim().toUpperCase()
        if (trimmed.length !== 6) {
            showAppError("Enter a valid 6-character room code")
            return
        }

        setIsPeekingRoom(true)
        try {
            const result = await peekRPSRoom(trimmed)
            if (!result.success || !result.room) {
                showAppError(result.error || "Room not found")
                return
            }
            setRoomPreview(result.room)
        } catch {
            showAppError("Failed to look up room")
        } finally {
            setIsPeekingRoom(false)
        }
    }

    const cancelJoinPreview = () => setRoomPreview(null)

    // ─── Step 2: Confirm — this is the ONLY point escrow gets locked ─
    const confirmJoinRoom = async () => {
        if (!roomPreview) return
        const trimmed = roomPreview.room_code

        setIsLoading(true)
        try {
            const result = await joinRPSMatch(trimmed)
            if (!result.success) {
                showAppError(result.error || "Failed to join match")
                return
            }
            setMatchId(result.match_id!)
            setMode("friend")
            setRoomCode(trimmed)
            setStakeAmount(result.stake!)
            setIsPlayerA(false)
            setPlayerScore(0)
            setOpponentScore(0)
            setRoundHistory([])
            setMatchResult(null)
            lastRoundRef.current = 0
            scoreHistoryRef.current = { 0: { myScore: 0, oppScore: 0 } }
            setPhase("choosing")
            setStarBalance(result.new_balance ?? null)
            showAppToast(`${result.stake} Stars locked as escrow`, { icon: Lock, variant: "xp" })

            subscribeToMatch(result.match_id!)
            const { data: matchData } = await supabase
                .from("rps_matches")
                .select("player_a")
                .eq("id", result.match_id)
                .single()
            if (matchData?.player_a) fetchOpponentName(matchData.player_a)
        } catch {
            showAppError("Failed to join match")
        } finally {
            setIsLoading(false)
            setRoomPreview(null)
        }
    }


    // ═══════════════════════════════════════════════════════════════
    // ROUND RESOLUTION — Deferred score/history updates
    // Scores and round history ONLY update after the 3-second
    // countdown completes, not when the server sends the data.
    // ═══════════════════════════════════════════════════════════════

    const showRoundReveal = (myChoice: RPSMove, result: RPSActionResult) => {
        const roundNum = (result.current_round || 2) - 1
        if (roundNum <= lastRoundRef.current) return

        const amA = isPlayerA
        const myMove = myChoice
        const oppMove = (amA ? result.move_b : result.move_a) as RPSMove

        setOpponentChoice(oppMove)

        let personalResult: "win" | "lose" | "tie"
        if (result.round_result === "tie") personalResult = "tie"
        else if ((amA && result.round_result === "a_wins") || (!amA && result.round_result === "b_wins")) personalResult = "win"
        else personalResult = "lose"

        lastRoundRef.current = roundNum
        setLastResult(personalResult)

        // Defer history update — store for after reveal
        setRoundHistory(prev => [...prev, {
            round: roundNum,
            playerChoice: myMove,
            opponentChoice: oppMove,
            result: personalResult,
        }])

        // Defer score update — stored in ref, applied during reveal phase
        const myScore = amA ? (result.score_a || 0) : (result.score_b || 0)
        const oppScore = amA ? (result.score_b || 0) : (result.score_a || 0)
        pendingScoresRef.current = { myScore, oppScore }
        scoreHistoryRef.current[roundNum] = { myScore, oppScore }

        setPhase("countdown")
        setCountdown(3)
    }

    const handleChoice = async (choice: RPSMove) => {
        if (phase !== "choosing" || !choice || !matchId || isSubmitting) return

        setPlayerChoice(choice)
        setIsSubmitting(true)
        setPhase("waiting")

        try {
            const result = await submitRPSMove(matchId, choice, roundVersionRef.current)
            if (!result.success) {
                if (result.error?.includes('already submitted')) return
                showAppError(result.error || "Failed to submit move")
                setPhase("choosing")
                setPlayerChoice(null)
                return
            }

            if (result.status === "stale_version") {
                roundVersionRef.current = result.current_round_version || 0
                setPhase("choosing")
                setPlayerChoice(null)
                showAppError("Race condition avoided! Please submit again.")
                return
            }

            if (result.status === "waiting_for_opponent") {
                roundVersionRef.current = result.round_version || roundVersionRef.current
                return
            }

            if (result.status === "round_resolved" || result.status === "match_completed") {
                roundVersionRef.current = result.round_version || roundVersionRef.current
                showRoundReveal(choice, result)
            }
        } catch {
            showAppError("Failed to submit move")
            setPhase("choosing")
            setPlayerChoice(null)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── Handle realtime round resolution (when OTHER player triggered it) ───
    useEffect(() => {
        if (!match || phase === "matchEnd") return

        const currentServerRound = match.current_round - 1
        if (
            currentServerRound > lastRoundRef.current &&
            match.last_move_a && match.last_move_b
        ) {
            const amA = isPlayerA
            const myMove = (amA ? match.last_move_a : match.last_move_b) as RPSMove
            const oppMove = (amA ? match.last_move_b : match.last_move_a) as RPSMove

            setPlayerChoice(myMove)

            setOpponentChoice(oppMove)

            let personalResult: "win" | "lose" | "tie"
            if (match.last_round_result === "tie") personalResult = "tie"
            else if ((amA && match.last_round_result === "a_wins") || (!amA && match.last_round_result === "b_wins")) personalResult = "win"
            else personalResult = "lose"

            lastRoundRef.current = currentServerRound
            setLastResult(personalResult)

            setRoundHistory(prev => [...prev, {
                round: currentServerRound,
                playerChoice: myMove,
                opponentChoice: oppMove,
                result: personalResult,
            }])

            const newMyScore = amA ? match.score_a : match.score_b
            const newOppScore = amA ? match.score_b : match.score_a
            pendingScoresRef.current = { myScore: newMyScore, oppScore: newOppScore }
            scoreHistoryRef.current[currentServerRound] = { myScore: newMyScore, oppScore: newOppScore }

            // MUST update round version so subsequent moves don't get rejected as stale!
            roundVersionRef.current = match.round_version

            setPhase("countdown")
            setCountdown(3)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [match?.current_round, match?.move_a, match?.move_b, match?.last_move_a, match?.last_move_b])

    // ─── Countdown & Reveal timer ───
    // Scores update ONLY when reveal phase starts (after 3s countdown).
    useEffect(() => {
        if (phase === "countdown") {
            if (countdown > 0) {
                const timer = setTimeout(() => setCountdown(c => c - 1), 600)
                return () => clearTimeout(timer)
            } else {
                setPhase("reveal")
            }
        } else if (phase === "reveal") {
            // Apply pending scores NOW (after countdown completes)
            if (pendingScoresRef.current) {
                setPlayerScore(pendingScoresRef.current.myScore)
                setOpponentScore(pendingScoresRef.current.oppScore)
                pendingScoresRef.current = null
            }
            const timer = setTimeout(() => {
                if (match?.status === "completed" || matchResult) {
                    setPhase("matchEnd")
                } else {
                    setPhase("choosing")
                    setPlayerChoice(null)
                    setOpponentChoice(null)
                }
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [phase, countdown, match?.status, matchResult])

    // ─── Move deadline countdown (60s per round) ───
    useEffect(() => {
        if ((phase === "choosing" || phase === "waiting") && match?.move_deadline_at) {
            const deadline = new Date(match.move_deadline_at).getTime()
            const tick = () => {
                const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
                setMoveTimeLeft(remaining)
            }
            tick()
            const interval = setInterval(tick, 1000)
            return () => {
                clearInterval(interval)
                setMoveTimeLeft(null)
            }
        } else {
            setMoveTimeLeft(null)
        }
    }, [phase, match?.move_deadline_at])

    // ─── Move deadline ENFORCEMENT ───
    // The countdown above is purely cosmetic on its own — nothing
    // previously happened when it hit 0. That's the "opponent goes quiet
    // but doesn't formally disconnect" gap: presence-based detection only
    // fires for an actual dropped connection, so a present-but-unresponsive
    // (or simply unwilling) opponent could sit there forever and the
    // remaining player had no way out short of manually forfeiting their
    // own stake. This effect closes that gap: once the 60s deadline for
    // the CURRENT round passes, whichever side hasn't submitted a move
    // is defaulted via the same AI-takeover RPC used for disconnects —
    // that player forfeits their stake for the match, and the remaining
    // player keeps playing against AI (2x payout on a win, normal loss
    // of their own stake if they lose).
    const deadlineTriggeredRef = useRef<string | null>(null)
    useEffect(() => {
        if (mode !== "friend" || match?.status !== "active" || !match?.move_deadline_at) return
        if (aiActive) return // already handled — don't double-trigger

        const deadline = new Date(match.move_deadline_at).getTime()
        const msRemaining = deadline - Date.now()

        const fire = () => {
            // Guard against firing twice for the same deadline (e.g. once
            // from this effect's timer and once from a re-render tick).
            if (deadlineTriggeredRef.current === match.move_deadline_at) return
            deadlineTriggeredRef.current = match.move_deadline_at as string

            const m = matchRef.current
            if (!m) return

            // Only act when there is exactly ONE side still missing a
            // move — i.e. it is unambiguously "their turn" and they
            // haven't picked. If neither side has moved (e.g. we're
            // racing a brand-new round's deadline just after the previous
            // one resolved) or both already have, there is no single
            // player whose stalling is provable, so we do nothing rather
            // than guess and wrongly forfeit whoever happens to be
            // player_a.
            const aMissing = !m.move_a
            const bMissing = !m.move_b
            const stallingId = aMissing && !bMissing ? m.player_a
                : bMissing && !aMissing ? m.player_b
                : null
            if (!stallingId) return

            fireAITakeover(m.id, stallingId).then(res => {
                if (res.success && (res.action === 'ai_takeover' || res.action === 'already_ai')) {
                    if (stallingId === profile.id) {
                        showAppToast("You missed the 60s move window — your stake is forfeited. AI takes over your side.", { duration: 5000, variant: "error" })
                    } else {
                        showAppToast("Opponent missed the move window! AI takes over their side.", { duration: 5000, variant: "success" })
                    }
                }
            })
        }

        if (msRemaining <= 0) {
            fire()
            return
        }
        const timeout = setTimeout(fire, msRemaining)
        return () => clearTimeout(timeout)
    }, [mode, match?.status, match?.move_deadline_at, match?.move_a, match?.move_b, aiActive, profile.id, fireAITakeover])


    // ═══════════════════════════════════════════════════════════════
    // RESET / CLEANUP / EXIT
    // ═══════════════════════════════════════════════════════════════

    const resetToLobby = () => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }
        clearDisconnectTimers()
        setMatchId(null)
        setMatch(null)
        setMode(null)
        setRoomCode("")
        setPhase("choosing")
        setPlayerChoice(null)
        setOpponentChoice(null)
        setPlayerScore(0)
        setOpponentScore(0)
        setRoundHistory([])
        setCountdown(3)
        setMatchResult(null)
        setLastResult(null)
        setOpponentName("")
        setIsPlayerA(true)
        setMoveTimeLeft(null)
        lastRoundRef.current = 0
        roundVersionRef.current = 0
        scoreHistoryRef.current = { 0: { myScore: 0, oppScore: 0 } }
        pendingScoresRef.current = null
        opponentJoinedRef.current = false
        prevAiStateRef.current = { aiPlayer: null, disconnectedPlayer: null }
        deadlineTriggeredRef.current = null
        aiTakeoverInFlightRef.current = false
        reconnectInFlightRef.current = false
    }

    const handlePlayAgain = async () => {
        const prevMode = mode
        const prevStake = stakeAmount
        resetToLobby()
        if (prevMode) {
            setPendingMode(prevMode)
            setStakeAmount(prevStake)

            // The match that just ended paid out (win) or deducted (loss)
            // Stars server-side. The cached starBalance still reflects the
            // amount from BEFORE that settlement, so it must be re-fetched
            // here — otherwise the stake selector shows a stale figure
            // instead of the player's real, current XP balance.
            try {
                const result = await getRPSBalance()
                setStarBalance(result.success ? result.balance : null)
            } catch {
                setStarBalance(null)
            }

            setShowStakeSelector(true)
        }
    }

    const handleBack = () => {
        if (matchId && phase !== "matchEnd" && match?.status !== "completed") {
            setShowExitConfirm(true)
            return
        }
        if (mode) resetToLobby()
        else router.push("/dashboard")
    }

    // ─── VOLUNTARY EXIT — Stake forfeiture (irreversible) ───
    // When a player explicitly chooses to leave an active match,
    // their full stake is transferred to the opponent. This action
    // is clearly communicated and cannot be undone.
    const confirmExit = async () => {
        setShowExitConfirm(false)
        if (matchId) {
            const result = await cancelRPSMatch(matchId)
            if (result.success) {
                if (result.action === "refunded") {
                    showAppToast("Match cancelled — escrow refunded", { icon: Undo2, variant: "info" })
                } else {
                    showAppError(`You forfeited ${stakeAmount} Stars! Stake transferred to opponent.`)
                }
            }
        }
        resetToLobby()
    }

    const handleShareRoom = async () => {
        const url = `${window.location.origin}/rps?join=${roomCode}`
        if (navigator.share) {
            try { await navigator.share({ title: "Join my RPS game!", text: `Room code: ${roomCode}`, url }) } catch { /* cancelled */ }
        } else {
            await navigator.clipboard.writeText(url)
            showAppSuccess("Room link copied!")
        }
    }

    const handleLoadHistory = async () => {
        setIsLoadingHistory(true)
        setShowHistory(true)
        const result = await getPlayerRPSHistory(20)
        setIsLoadingHistory(false)
        if (result.success && result.matches) setHistoryData(result.matches)
        else showAppError("Failed to load match history")
    }

    // ─── Switch to AI from waiting room ───
    // Cancels the waiting friend match (refund) then starts a solo match.
    const switchToAI = async () => {
        if (!matchId) return
        setIsLoading(true)
        try {
            const cancelResult = await cancelRPSMatch(matchId)
            if (cancelResult.success) showAppToast("Match cancelled — starting solo!", { icon: Bot, variant: "warning" })
            resetToLobby()
            setPendingMode("solo")
            setShowStakeSelector(true)
        } catch {
            showAppError("Failed to switch to AI")
        } finally {
            setIsLoading(false)
        }
    }

    return {
        // State
        profile,
        matchId, match, mode, roomCode, isPlayerA,
        phase, playerChoice, opponentChoice, playerScore, opponentScore, roundHistory, countdown, matchResult, lastResult, opponentName,
        showExitConfirm, showJoinInput, joinRoomId, starBalance, showBalanceGate, isLoading, isSubmitting, isRecovering, pendingMode, stakeAmount, disconnectCountdown, moveTimeLeft, aiActive,
        showHistory, historyData, isLoadingHistory, currentRound: roundHistory.length + 1,
        showStakeSelector, roomPreview, isPeekingRoom,

        // Actions
        setJoinRoomId, setShowJoinInput, setShowHistory, setShowBalanceGate, setShowExitConfirm, setShowStakeSelector, setStakeAmount,
        
        handleChoice, handleModeSelect, handlePeekRoom, confirmJoinRoom, cancelJoinPreview, handlePlayAgain, handleBack, confirmExit, handleShareRoom, handleLoadHistory,
        switchToAI, startMatch, handleStakeConfirm,
        triggerImmediateAI,  // Exposed for "Switch to AI now" button in disconnect banner
    }
}
