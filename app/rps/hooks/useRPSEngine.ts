import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    createRPSMatch,
    joinRPSMatch,
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
    const [starBalance, setStarBalance] = useState<number | null>(null)
    const [showBalanceGate, setShowBalanceGate] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isRecovering, setIsRecovering] = useState(true)
    const [pendingMode, setPendingMode] = useState<"solo" | "friend" | null>(null)
    const [stakeAmount, setStakeAmount] = useState(100)
    const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null)
    const [moveTimeLeft, setMoveTimeLeft] = useState<number | null>(null)
    const [aiActive, setAiActive] = useState(false)
    
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

    // Trigger immediate AI takeover (exposed to UI for "Switch to AI now" button)
    const triggerImmediateAI = useCallback(async () => {
        const currentMatch = matchRef.current
        if (!currentMatch) return
        const leftUserId = currentMatch.player_a === profile.id
            ? currentMatch.player_b
            : currentMatch.player_a
        if (!leftUserId || !currentMatch.id) return

        clearDisconnectTimers()

        const res = await triggerAITakeover(currentMatch.id, leftUserId)
        if (res.success && (res.action === 'ai_takeover' || res.action === 'already_ai')) {
            setAiActive(true)
            toast.success("AI is stepping in 🤖", { id: "disconnect-toast", duration: 4000 })
        } else if (res.action === 'auto_forfeit') {
            // Opponent hit 3 disconnects — they auto-forfeit
            toast.success("Opponent auto-forfeited! You win! 🏆", { id: "disconnect-toast", duration: 5000 })
        } else {
            toast.dismiss("disconnect-toast")
        }
    }, [profile.id, clearDisconnectTimers])


    // ═══════════════════════════════════════════════════════════════
    // REALTIME SUBSCRIPTION — Postgres Changes + Presence
    // ═══════════════════════════════════════════════════════════════

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
                    
                    if (!stillPresent && !disconnectTimerRef.current) {
                        let secondsLeft = DISCONNECT_TIMEOUT_SECONDS
                        setDisconnectCountdown(secondsLeft)
                        toast(`Opponent lost connection… waiting ${DISCONNECT_TIMEOUT_SECONDS}s`, {
                            icon: "⚠️", id: "disconnect-toast", duration: (DISCONNECT_TIMEOUT_SECONDS + 1) * 1000
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
                            
                            // Trigger AI takeover via RPC
                            const currentMatch = matchRef.current
                            const leftUserId = currentMatch?.player_a === profile.id
                                ? currentMatch?.player_b
                                : currentMatch?.player_a
                            if (leftUserId && currentMatch) {
                                triggerAITakeover(mId, leftUserId).then(res => {
                                    if (res.success && (res.action === 'ai_takeover' || res.action === 'already_ai')) {
                                        setAiActive(true)
                                        toast.success("AI is stepping in 🤖", { id: "disconnect-toast", duration: 4000 })
                                    } else if (res.action === 'auto_forfeit') {
                                        toast.success("Opponent auto-forfeited! You win! 🏆", { id: "disconnect-toast", duration: 5000 })
                                    } else {
                                        toast.dismiss("disconnect-toast")
                                    }
                                    setDisconnectCountdown(null)
                                })
                            }
                        }, DISCONNECT_TIMEOUT_SECONDS * 1000)
                    }
                }
            })

            // ─── RECONNECTION DETECTION (presence join) ───
            // When opponent comes back, clear timers and call reconnect RPC
            // so AI hands back control (after finishing any in-progress round).
            .on("presence", { event: "join" }, ({ newPresences }) => {
                if (newPresences.some((p: any) => p.user_id !== profile.id)) {
                    clearDisconnectTimers()

                    // If AI was active, call reconnect RPC to hand control back
                    const currentMatch = matchRef.current
                    if (currentMatch && currentMatch.ai_player && currentMatch.disconnected_player) {
                        reconnectToMatch(currentMatch.id).then(res => {
                            if (res.success && res.action === 'reconnected') {
                                setAiActive(false)
                                toast.success("Opponent reconnected! Game continues. 🎉", { id: "disconnect-toast" })
                            } else if (res.action === 'reconnected_round_in_progress') {
                                // AI will finish the current round, then control returns
                                toast.success("Opponent is back! AI finishing current round…", { id: "disconnect-toast" })
                            }
                        })
                    } else {
                        toast.success("Opponent reconnected!", { id: "disconnect-toast" })
                    }
                }
            })

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: profile.id, online_at: new Date().toISOString() })
            }
        })

        channelRef.current = channel
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, profile.id, clearDisconnectTimers])

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

        // ─── AI Takeover detection ───
        if (updated.ai_player && !aiActive) {
            setAiActive(true)
            // Don't change mode — match stays 'friend' for reconnection
            setOpponentName(prev => prev ? `${prev} (AI)` : "AI 🤖")
            toast("AI has temporarily taken over for your opponent", { icon: "🤖" })
        }

        // ─── AI cleared (opponent reconnected and round finished) ───
        if (!updated.ai_player && aiActive && updated.disconnected_player === null) {
            setAiActive(false)
            // Restore original opponent name
            setOpponentName(prev => prev.replace(" (AI)", ""))
            toast.success("Opponent is back in control! 🎮")
        }

        // ─── Opponent joined (waiting → active) — fire toast ONCE ───
        if (updated.status === "active" && updated.player_b && updated.mode === "friend") {
            if (!opponentName || opponentName === "AI 🤖") {
                const otherId = amA ? updated.player_b : updated.player_a
                if (otherId) fetchOpponentName(otherId)
            }
            if (!opponentJoinedRef.current) {
                opponentJoinedRef.current = true
                setPhase("choosing")
                toast.success("Opponent joined! Game on! 🎮", { duration: 3000 })
            }
        }

        // ─── DEFERRED SCORE UPDATE ───
        // Only update scores if we've already revealed this round.
        // New rounds go through countdown → reveal → score update.
        const resolvedRound = updated.current_round - 1
        if (resolvedRound <= lastRoundRef.current) {
            const myScore = amA ? updated.score_a : updated.score_b
            const oppScore = amA ? updated.score_b : updated.score_a
            setPlayerScore(myScore)
            setOpponentScore(oppScore)
        }

        // ─── Match completed — set result (scores come after reveal) ───
        if (updated.status === "completed") {
            if (updated.winner_id === profile.id) setMatchResult("won")
            else setMatchResult("lost")
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id, opponentName, aiActive])


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
                    if (m.ai_player) setAiActive(true)

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
                        const reconnResult = await reconnectToMatch(m.id)
                        if (reconnResult.success) {
                            if (reconnResult.action === 'reconnected') {
                                setAiActive(false)
                                toast.success("Welcome back! You're in control again 🎮", { duration: 4000 })
                            } else if (reconnResult.action === 'reconnected_round_in_progress') {
                                toast("Welcome back! AI is finishing the current round…", { icon: "🤖", duration: 4000 })
                            }
                        }
                    } else {
                        toast("Game restored from server", { icon: "🔄" })
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
                toast.error(result.error || "Failed to create match")
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
            toast(`${stake} Stars locked as escrow ⭐`, { icon: "🔒" })

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
            toast.error("Failed to create match")
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

            if (balance >= 100) {
                if (selectedMode === "solo") await startMatch("solo", 100)
                else await startMatch("friend", 100)
            } else if (balance > 0 && selectedMode === "solo") {
                setPendingMode(selectedMode)
                setStakeAmount(balance)
                setShowBalanceGate(true)
            } else {
                setPendingMode(selectedMode)
                setShowBalanceGate(true)
            }
        } catch {
            toast.error("Failed to check balance")
        } finally {
            setIsLoading(false)
        }
    }

    const handleJoinRoom = async (code: string) => {
        const trimmed = code.trim().toUpperCase()
        if (trimmed.length !== 6) {
            toast.error("Enter a valid 6-character room code")
            return
        }

        setIsLoading(true)
        try {
            const result = await joinRPSMatch(trimmed)
            if (!result.success) {
                toast.error(result.error || "Failed to join match")
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
            toast(`${result.stake} Stars locked as escrow ⭐`, { icon: "🔒" })

            subscribeToMatch(result.match_id!)
            const { data: matchData } = await supabase
                .from("rps_matches")
                .select("player_a")
                .eq("id", result.match_id)
                .single()
            if (matchData?.player_a) fetchOpponentName(matchData.player_a)
        } catch {
            toast.error("Failed to join match")
        } finally {
            setIsLoading(false)
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
                toast.error(result.error || "Failed to submit move")
                setPhase("choosing")
                setPlayerChoice(null)
                return
            }

            if (result.status === "stale_version") {
                roundVersionRef.current = result.current_round_version || 0
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
            toast.error("Failed to submit move")
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
            phase === "waiting" &&
            playerChoice &&
            match.move_a === null &&
            match.move_b === null &&
            currentServerRound > lastRoundRef.current &&
            match.last_move_a && match.last_move_b
        ) {
            const amA = isPlayerA
            const myMove = playerChoice
            const oppMove = (amA ? match.last_move_b : match.last_move_a) as RPSMove

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
        setAiActive(false)
        setMoveTimeLeft(null)
        lastRoundRef.current = 0
        roundVersionRef.current = 0
        scoreHistoryRef.current = { 0: { myScore: 0, oppScore: 0 } }
        pendingScoresRef.current = null
        opponentJoinedRef.current = false
    }

    const handlePlayAgain = async () => {
        const prevMode = mode
        const prevStake = stakeAmount
        resetToLobby()
        if (prevMode) await startMatch(prevMode, prevStake)
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
                    toast("Match cancelled — escrow refunded ⭐", { icon: "↩️" })
                } else {
                    toast.error(`You forfeited ${stakeAmount} Stars! Stake transferred to opponent.`)
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
            toast.success("Room link copied!")
        }
    }

    const handleLoadHistory = async () => {
        setIsLoadingHistory(true)
        setShowHistory(true)
        const result = await getPlayerRPSHistory(20)
        setIsLoadingHistory(false)
        if (result.success && result.matches) setHistoryData(result.matches)
        else toast.error("Failed to load match history")
    }

    // ─── Switch to AI from waiting room ───
    // Cancels the waiting friend match (refund) then starts a solo match.
    const switchToAI = async () => {
        if (!matchId) return
        setIsLoading(true)
        try {
            const cancelResult = await cancelRPSMatch(matchId)
            if (cancelResult.success) toast("Match cancelled — starting solo!", { icon: "🤖" })
            resetToLobby()
            await startMatch("solo", stakeAmount)
        } catch {
            toast.error("Failed to switch to AI")
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

        // Actions
        setJoinRoomId, setShowJoinInput, setShowHistory, setShowBalanceGate, setShowExitConfirm,
        
        handleChoice, handleModeSelect, handleJoinRoom, handlePlayAgain, handleBack, confirmExit, handleShareRoom, handleLoadHistory,
        switchToAI, startMatch,
        triggerImmediateAI,  // Exposed for "Switch to AI now" button in disconnect banner
    }
}
