"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowLeft, Share2, Loader2, Users, RotateCcw, Swords, Star, Monitor, UserPlus, History } from "lucide-react"
import { toast } from "sonner"
import {
    createRPSMatch,
    joinRPSMatch,
    submitRPSMove,
    cancelRPSMatch,
    getActiveRPSMatch,
    getRPSBalance,
    triggerAITakeover,
    getPlayerRPSHistory,
    type RPSMatch,
    type RPSMove,
    type RPSActionResult,
    type RPSMatchHistoryItem,
} from "@/actions/rps"

type GamePhase = "choosing" | "waiting" | "countdown" | "reveal" | "matchEnd"

interface RoundHistory {
    round: number
    playerChoice: RPSMove
    opponentChoice: RPSMove
    result: "win" | "lose" | "tie"
}

const CHOICES: { id: RPSMove; emoji: string; label: string }[] = [
    { id: "rock", emoji: "✊", label: "Rock" },
    { id: "paper", emoji: "✋", label: "Paper" },
    { id: "scissors", emoji: "✌️", label: "Scissors" },
]

interface RPSGameClientProps {
    profile: { id: string; username: string; slug: string; is_pro: boolean }
}

export default function RPSGameClient({ profile }: RPSGameClientProps) {
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

    // ─── Recover active match on mount ───
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
                        // If we already submitted a move this round, show waiting
                        const myMove = m.player_a === profile.id ? m.move_a : m.move_b
                        if (myMove) {
                            setPlayerChoice(myMove as RPSMove)
                            setPhase("waiting")
                        }
                    }

                    // Subscribe to updates
                    subscribeToMatch(m.id)

                    // Fetch opponent name for friend matches
                    if (m.mode === "friend") {
                        const otherId = m.player_a === profile.id ? m.player_b : m.player_a
                        if (otherId) {
                            fetchOpponentName(otherId)
                        }
                    }

                    toast("Game restored from server", { icon: "🔄" })
                }
            } catch (err) {
                console.error("Recovery error:", err)
            } finally {
                if (!cancelled) setIsRecovering(false)
            }
        }

        recover()

        // Check URL for join code
        const params = new URLSearchParams(window.location.search)
        const joinCode = params.get("join")
        if (joinCode) {
            setJoinRoomId(joinCode.toUpperCase())
            setShowJoinInput(true)
        }

        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ─── Fetch opponent name ───
    const fetchOpponentName = async (userId: string) => {
        const { data } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", userId)
            .single()
        if (data?.username) setOpponentName(data.username)
    }

    // ─── Subscribe to match updates via Postgres Changes & Presence ───
    const subscribeToMatch = useCallback((mId: string) => {
        // Clean up previous channel
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
            .on("presence", { event: "leave" }, () => {
                if (modeRef.current === "friend") {
                    const state = channel.presenceState()
                    const stillPresent = Object.values(state).flat().some((p: any) => p.user_id !== profile.id)
                    
                    if (!stillPresent) {
                        if (!disconnectTimerRef.current) {
                            // Start visible 30s countdown
                            let secondsLeft = 30
                            setDisconnectCountdown(secondsLeft)
                            toast("Opponent lost connection… waiting 30s", { icon: "⚠️", id: "disconnect-toast", duration: 31000 })
                            
                            disconnectIntervalRef.current = setInterval(() => {
                                secondsLeft--
                                setDisconnectCountdown(secondsLeft)
                                if (secondsLeft <= 0) {
                                    if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current)
                                }
                            }, 1000)

                            disconnectTimerRef.current = setTimeout(() => {
                                const currentPresence = channel.presenceState()
                                const isHereNow = Object.values(currentPresence).flat().some((p: any) => p.user_id !== profile.id)
                                if (isHereNow) {
                                    disconnectTimerRef.current = null
                                    setDisconnectCountdown(null)
                                    return
                                }
                                
                                const currentMatch = matchRef.current
                                const leftUserId = currentMatch?.player_a === profile.id ? currentMatch?.player_b : currentMatch?.player_a
                                if (leftUserId) {
                                    triggerAITakeover(mId, leftUserId).then(res => {
                                        if (res.success && (res.action === 'ai_takeover' || res.action === 'already_ai')) {
                                            setAiActive(true)
                                            toast.success("AI is stepping in 🤖", { id: "disconnect-toast", duration: 4000 })
                                        } else {
                                            toast.dismiss("disconnect-toast")
                                        }
                                        setDisconnectCountdown(null)
                                    })
                                }
                            }, 30000)
                        }
                    }
                }
            })
            .on("presence", { event: "join" }, ({ key, newPresences }) => {
                if (newPresences.some((p: any) => p.user_id !== profile.id)) {
                    if (disconnectTimerRef.current) {
                        clearTimeout(disconnectTimerRef.current)
                        disconnectTimerRef.current = null
                    }
                    if (disconnectIntervalRef.current) {
                        clearInterval(disconnectIntervalRef.current)
                        disconnectIntervalRef.current = null
                    }
                    setDisconnectCountdown(null)
                    toast.success("Opponent reconnected!", { id: "disconnect-toast" })
                }
            })

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: profile.id, online_at: new Date().toISOString() })
            }
        })

        channelRef.current = channel
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, profile.id])

    // Cleanup channel on unmount
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [supabase])

    // ─── Handle incoming match state update ───
    const handleMatchUpdate = useCallback((updated: RPSMatch) => {
        setMatch(updated)

        const amA = updated.player_a === profile.id
        setIsPlayerA(amA)

        // If AI takeover detected
        if (updated.ai_player && !aiActive) {
            setAiActive(true)
            setMode("solo")
            setOpponentName("AI 🤖")
            toast("AI has taken over for your opponent!", { icon: "🤖" })
        }

        // Opponent joined (match went from waiting → active) — fire toast ONCE only
        if (updated.status === "active" && updated.player_b && updated.mode === "friend") {
            if (!opponentName) {
                const otherId = amA ? updated.player_b : updated.player_a
                if (otherId) fetchOpponentName(otherId)
            }
            if (!opponentJoinedRef.current) {
                opponentJoinedRef.current = true
                setPhase("choosing")
                toast.success("Opponent joined! Game on! 🎮", { duration: 3000 })
            }
        }

        // ═══ DEFERRED SCORE UPDATE LOGIC ═══
        // Only update scores if we've already revealed this round.
        // If a new round was just resolved, the realtime useEffect below
        // will handle the countdown → reveal → score update flow.
        const resolvedRound = updated.current_round - 1
        if (resolvedRound <= lastRoundRef.current) {
            const myScore = amA ? updated.score_a : updated.score_b
            const oppScore = amA ? updated.score_b : updated.score_a
            setPlayerScore(myScore)
            setOpponentScore(oppScore)
        }

        // Match completed — only set result, scores come after reveal
        if (updated.status === "completed") {
            if (updated.winner_id === profile.id) {
                setMatchResult("won")
            } else {
                setMatchResult("lost")
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id, opponentName])

    // ─── Mode selection with balance check ───
    const handleModeSelect = async (selectedMode: "solo" | "friend") => {
        setIsLoading(true)
        try {
            const result = await getRPSBalance()
            const balance = result.success ? result.balance : 0
            setStarBalance(balance)

            if (balance >= 100) {
                if (selectedMode === "solo") {
                    await startMatch("solo", 100)
                } else {
                    await startMatch("friend", 100)
                }
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

    // ─── Create match via server action ───
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

            if (matchMode === "solo") {
                setPhase("choosing")
            }

            subscribeToMatch(result.match_id!)
        } catch (err) {
            toast.error("Failed to create match")
        } finally {
            setIsLoading(false)
        }
    }

    // ─── Join match via server action ───
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

    // ─── Submit move via server action ───
    const handleChoice = async (choice: RPSMove) => {
        if (phase !== "choosing" || !choice || !matchId || isSubmitting) return

        setPlayerChoice(choice)
        setIsSubmitting(true)
        setPhase("waiting")

        try {
            const result = await submitRPSMove(matchId, choice, roundVersionRef.current)

            if (!result.success) {
                // If it's a duplicate move error, just stay in waiting state
                if (result.error?.includes('already submitted')) {
                    return
                }
                toast.error(result.error || "Failed to submit move")
                setPhase("choosing")
                setPlayerChoice(null)
                return
            }

            if (result.status === "stale_version") {
                // Round already resolved — sync and return
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
        } catch (err) {
            toast.error("Failed to submit move")
            setPhase("choosing")
            setPlayerChoice(null)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── Show round reveal animation (called by RPC trigger player) ───
    const showRoundReveal = (myChoice: RPSMove, result: RPSActionResult) => {
        const roundNum = (result.current_round || 2) - 1
        if (roundNum <= lastRoundRef.current) return

        const amA = isPlayerA
        const myMove = myChoice
        const oppMove = (amA ? result.move_b : result.move_a) as RPSMove

        setOpponentChoice(oppMove)

        let personalResult: "win" | "lose" | "tie"
        if (result.round_result === "tie") {
            personalResult = "tie"
        } else if ((amA && result.round_result === "a_wins") || (!amA && result.round_result === "b_wins")) {
            personalResult = "win"
        } else {
            personalResult = "lose"
        }

        lastRoundRef.current = roundNum
        setLastResult(personalResult)

        setRoundHistory(prev => [...prev, {
            round: roundNum,
            playerChoice: myMove,
            opponentChoice: oppMove,
            result: personalResult,
        }])

        // Defer score update — store pending scores for after reveal
        const myScore = amA ? (result.score_a || 0) : (result.score_b || 0)
        const oppScore = amA ? (result.score_b || 0) : (result.score_a || 0)
        pendingScoresRef.current = { myScore, oppScore }
        scoreHistoryRef.current[roundNum] = { myScore, oppScore }

        setPhase("countdown")
        setCountdown(3)
    }

    // ─── Handle realtime round resolution (when OTHER player triggered it) ───
    // Uses last_move_a / last_move_b from the DB — no inference needed!
    useEffect(() => {
        if (!match || phase === "matchEnd") return

        const currentServerRound = match.current_round - 1
        if (
            phase === "waiting" &&
            playerChoice &&
            match.move_a === null &&
            match.move_b === null &&
            currentServerRound > lastRoundRef.current &&
            match.last_move_a && match.last_move_b  // Ensure the server stored the moves
        ) {
            const amA = isPlayerA
            const myMove = playerChoice
            const oppMove = (amA ? match.last_move_b : match.last_move_a) as RPSMove

            setOpponentChoice(oppMove)

            // Use the server's round result directly
            let personalResult: "win" | "lose" | "tie"
            if (match.last_round_result === "tie") {
                personalResult = "tie"
            } else if ((amA && match.last_round_result === "a_wins") || (!amA && match.last_round_result === "b_wins")) {
                personalResult = "win"
            } else {
                personalResult = "lose"
            }

            lastRoundRef.current = currentServerRound
            setLastResult(personalResult)

            setRoundHistory(prev => [...prev, {
                round: currentServerRound,
                playerChoice: myMove,
                opponentChoice: oppMove,
                result: personalResult,
            }])

            // Defer score update — store pending scores for after reveal
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
    useEffect(() => {
        if (phase === "countdown") {
            if (countdown > 0) {
                const timer = setTimeout(() => setCountdown(c => c - 1), 600)
                return () => clearTimeout(timer)
            } else {
                setPhase("reveal")
            }
        } else if (phase === "reveal") {
            // Apply pending scores NOW (after countdown, during reveal)
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

    // ─── Reset / cleanup ───
    const resetToLobby = () => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }
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
        setDisconnectCountdown(null)
        setMoveTimeLeft(null)
        lastRoundRef.current = 0
        roundVersionRef.current = 0
        scoreHistoryRef.current = { 0: { myScore: 0, oppScore: 0 } }
        pendingScoresRef.current = null
        opponentJoinedRef.current = false
        if (disconnectIntervalRef.current) {
            clearInterval(disconnectIntervalRef.current)
            disconnectIntervalRef.current = null
        }
    }

    // ─── Play again ───
    const handlePlayAgain = async () => {
        const prevMode = mode
        const prevStake = stakeAmount
        resetToLobby()

        // Start a new match with same mode
        if (prevMode) {
            await startMatch(prevMode, prevStake)
        }
    }

    // ─── Back / exit ───
    const handleBack = () => {
        if (matchId && phase !== "matchEnd" && match?.status !== "completed") {
            setShowExitConfirm(true)
            return
        }
        if (mode) {
            resetToLobby()
        } else {
            router.push("/dashboard")
        }
    }

    const confirmExit = async () => {
        setShowExitConfirm(false)
        if (matchId) {
            const result = await cancelRPSMatch(matchId)
            if (result.success) {
                if (result.action === "refunded") {
                    toast("Match cancelled — escrow refunded ⭐", { icon: "↩️" })
                } else {
                    toast.error("You forfeited your escrow!")
                }
            }
        }
        resetToLobby()
    }

    // ─── Share room ───
    const handleShareRoom = async () => {
        const url = `${window.location.origin}/rps?join=${roomCode}`
        if (navigator.share) {
            try {
                await navigator.share({ title: "Join my RPS game!", text: `Room code: ${roomCode}`, url })
            } catch { /* cancelled */ }
        } else {
            await navigator.clipboard.writeText(url)
            toast.success("Room link copied!")
        }
    }

    // ─── Match history ───
    const handleLoadHistory = async () => {
        setIsLoadingHistory(true)
        setShowHistory(true)
        const result = await getPlayerRPSHistory(20)
        setIsLoadingHistory(false)
        if (result.success && result.matches) {
            setHistoryData(result.matches)
        } else {
            toast.error("Failed to load match history")
        }
    }

    // ─── Helpers ───
    const choiceEmoji = (c: RPSMove | null) => CHOICES.find(x => x.id === c)?.emoji || "❓"
    const opponentLabel = mode === "solo" ? "Computer" : (opponentName || "Opponent")

    const resultColors: Record<string, string> = {
        win: "text-emerald-400",
        lose: "text-red-400",
        tie: "text-yellow-400"
    }
    const resultText: Record<string, string> = {
        win: "You Win!",
        lose: "You Lose!",
        tie: "It's a Tie!"
    }

    // ─── Loading state ───
    if (isRecovering) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 size={40} className="text-emerald-400 animate-spin mx-auto" />
                    <p className="text-white/40 text-sm">Loading game...</p>
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE SELECTION SCREEN
    // ═══════════════════════════════════════════════════════════════════
    if (!mode) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
                {/* Background */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/10 blur-[100px] rounded-full" />
                </div>

                {/* Header */}
                <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
                    <button onClick={() => router.push("/dashboard")} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Swords size={18} className="text-emerald-500" />
                        <h2 className="font-bold text-sm">Rock Paper Scissors</h2>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={handleLoadHistory}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition"
                        >
                            <History size={16} />
                        </button>
                        {starBalance !== null && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 rounded-full text-amber-400 text-xs font-bold">
                                <Star size={12} />
                                {starBalance}
                            </div>
                        )}
                    </div>
                </div>

                <main className="max-w-md mx-auto p-6 space-y-8 relative z-10 pt-12">
                    <div className="text-center space-y-3">
                        <div className="text-6xl animate-bounce">✊✋✌️</div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                            Rock Paper Scissors
                        </h1>
                        <p className="text-white/50 text-sm max-w-[260px] mx-auto">Best of 5 rounds. First to 3 wins!</p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => handleModeSelect("solo")}
                            disabled={isLoading}
                            className="w-full p-5 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-60"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Monitor size={28} />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-lg text-white">vs Computer</h3>
                                    <p className="text-xs text-white/40">Quick solo match against AI</p>
                                </div>
                                {isLoading && <Loader2 size={18} className="text-white/40 animate-spin ml-auto" />}
                            </div>
                        </button>

                        <button
                            onClick={() => handleModeSelect("friend")}
                            disabled={isLoading}
                            className="w-full p-5 bg-white/5 hover:bg-teal-500/10 border border-white/10 hover:border-teal-500/30 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-60"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <UserPlus size={28} />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-lg text-white">Create Room</h3>
                                    <p className="text-xs text-white/40">100 ⭐ escrow required</p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setShowJoinInput(!showJoinInput)}
                            className="w-full p-5 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-2xl transition-all active:scale-[0.98] group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Users size={28} />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-lg text-white">Join Room</h3>
                                    <p className="text-xs text-white/40">Enter a friend{"'"}s room code</p>
                                </div>
                            </div>
                        </button>

                        {showJoinInput && (
                            <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                <input
                                    value={joinRoomId}
                                    onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
                                    placeholder="ROOM CODE"
                                    maxLength={6}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono text-lg tracking-[0.3em] placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition uppercase"
                                />
                                <button
                                    onClick={() => handleJoinRoom(joinRoomId)}
                                    disabled={joinRoomId.length !== 6 || isLoading}
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Join"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Match History Modal */}
                    {showHistory && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
                            <div className="bg-[#14141f] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-xl text-white">Match History</h3>
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="text-white/40 hover:text-white w-8 h-8 flex items-center justify-center rounded-full bg-white/5"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                    {isLoadingHistory ? (
                                        <div className="py-12 flex justify-center">
                                            <Loader2 size={32} className="text-emerald-400 animate-spin opacity-50" />
                                        </div>
                                    ) : historyData.length === 0 ? (
                                        <div className="text-center py-12 space-y-2">
                                            <div className="text-4xl opacity-50">👻</div>
                                            <p className="text-white/40 text-sm">No recent matches found</p>
                                        </div>
                                    ) : (
                                        historyData.map((m) => (
                                            <div key={m.match_id} className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5 hover:border-white/10 transition">
                                                <div className="flex items-center gap-3">
                                                    {m.opponent_avatar ? (
                                                        <img src={m.opponent_avatar} alt="" className="w-10 h-10 rounded-full object-cover bg-white/10" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                                                            {m.opponent_name.charAt(0).toUpperCase() || "?"}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-sm text-white">
                                                            {m.opponent_name} {m.ai_player && <span className="text-xs text-white/40 font-normal ml-1">🤖</span>}
                                                        </p>
                                                        <p className="text-[10px] text-white/40 font-medium">
                                                            {new Date(m.completed_at || "").toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider mb-1
                                                        ${m.outcome === "won" ? "bg-emerald-500/20 text-emerald-400" 
                                                        : m.outcome === "lost" ? "bg-red-500/20 text-red-400" 
                                                        : "bg-white/10 text-white/50"}`}
                                                    >
                                                        {m.outcome.toUpperCase()}
                                                    </div>
                                                    <span className={`text-xs font-black ${m.xp_change > 0 ? "text-amber-400" : m.xp_change < 0 ? "text-red-400/80" : "text-white/30"}`}>
                                                        {m.xp_change > 0 ? "+" : ""}{m.xp_change} ⭐
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Balance Gate Modal */}
                    {showBalanceGate && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                            <div className="bg-[#14141f] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
                                <div className="text-center space-y-2">
                                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                                        <Star size={32} className="text-amber-400" />
                                    </div>
                                    <h3 className="text-xl font-black text-white">Insufficient Stars</h3>
                                    <p className="text-white/50 text-sm">
                                        You need <span className="text-amber-400 font-bold">100 Stars</span> to play.
                                        You have <span className="text-amber-400 font-bold">{starBalance} Stars</span>.
                                    </p>
                                </div>

                                {starBalance !== null && starBalance > 0 && pendingMode === "solo" ? (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => {
                                                setShowBalanceGate(false)
                                                startMatch("solo", starBalance)
                                            }}
                                            disabled={isLoading}
                                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition active:scale-95 disabled:opacity-60"
                                        >
                                            Play with {starBalance} Stars ⭐
                                        </button>
                                        <button
                                            onClick={() => setShowBalanceGate(false)}
                                            className="w-full py-3 text-white/40 hover:text-white/60 font-bold text-sm transition"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-center text-white/40 text-sm">Earn stars by playing other games!</p>
                                        <button
                                            onClick={() => setShowBalanceGate(false)}
                                            className="w-full py-3 text-white/40 hover:text-white/60 font-bold text-sm transition"
                                        >
                                            Close
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════
    // WAITING FOR OPPONENT (Friend mode only)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === "friend" && match?.status === "waiting") {
        return (
            <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/10 blur-[100px] rounded-full" />
                </div>

                <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
                    <button onClick={handleBack} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <Swords size={18} className="text-emerald-500" />
                    <h2 className="font-bold text-sm">Waiting for Friend</h2>
                </div>

                <main className="max-w-md mx-auto p-6 pt-20 relative z-10 flex flex-col items-center text-center space-y-8">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Loader2 size={40} className="text-emerald-400 animate-spin" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full animate-ping" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white">Share this code</h2>
                        <p className="text-sm text-white/40">Give this code to your friend to join</p>
                    </div>

                    <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-xs">
                        <p className="text-4xl font-black font-mono tracking-[0.4em] text-emerald-400 text-center">
                            {roomCode}
                        </p>
                    </div>

                    <button
                        onClick={handleShareRoom}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition active:scale-95 shadow-lg shadow-emerald-900/30"
                    >
                        <Share2 size={18} />
                        Share Invite Link
                    </button>

                    <div className="w-full max-w-xs space-y-3 pt-4 border-t border-white/5">
                        <p className="text-white/30 text-xs uppercase tracking-wider font-bold">or</p>

                        <button
                            onClick={async () => {
                                if (!matchId) return
                                setIsLoading(true)
                                try {
                                    // Cancel the waiting friend match (refund) then start solo
                                    const cancelResult = await cancelRPSMatch(matchId)
                                    if (cancelResult.success) {
                                        toast("Match cancelled — starting solo!", { icon: "🤖" })
                                    }
                                    resetToLobby()
                                    await startMatch("solo", stakeAmount)
                                } catch {
                                    toast.error("Failed to switch to AI")
                                } finally {
                                    setIsLoading(false)
                                }
                            }}
                            disabled={isLoading}
                            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Monitor size={18} />}
                            Continue vs AI Instead
                        </button>

                        <button
                            onClick={handleBack}
                            className="w-full py-3 text-white/40 hover:text-white/60 font-bold text-sm transition"
                        >
                            Cancel Match
                        </button>
                    </div>
                </main>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════
    // GAME ARENA
    // ═══════════════════════════════════════════════════════════════════
    const currentRound = roundHistory.length + 1

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden pb-8">
            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#12121a] border border-red-500/30 w-full max-w-sm rounded-3xl p-6 space-y-6 shadow-2xl shadow-red-500/10">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                            <ArrowLeft size={32} />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-white">Leave match?</h3>
                            <p className="text-white/60 text-sm">
                                {match?.status === "waiting"
                                    ? "Your escrow will be refunded."
                                    : <>If you leave now, you will <span className="text-red-400 font-bold">forfeit {stakeAmount} Stars</span>. Are you sure?</>
                                }
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmExit}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
                            >
                                {match?.status === "waiting" ? "Cancel Match" : "Leave Game"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/8 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/8 blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={handleBack} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <Swords size={18} className="text-emerald-500" />
                    <h2 className="font-bold text-sm">Best of 5</h2>
                </div>
                <div className="flex items-center gap-2">
                    {mode === "friend" && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-400">vs {opponentLabel}</span>
                        </div>
                    )}
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Round {Math.min(currentRound, 5)}/5</span>
                </div>
            </div>

            <main className="max-w-md mx-auto p-4 space-y-6 relative z-10">

                {/* Scoreboard */}
                <div className="flex items-center justify-center gap-4">
                    <div className="flex-1 text-center p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">You</p>
                        <p className="text-4xl font-black text-emerald-400">{playerScore}</p>
                    </div>
                    <div className="text-white/20 font-black text-2xl">:</div>
                    <div className="flex-1 text-center p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">{opponentLabel}</p>
                        <p className="text-4xl font-black text-red-400">{opponentScore}</p>
                    </div>
                </div>

                {/* Match End */}
                {phase === "matchEnd" && matchResult && (
                    <div className="text-center space-y-6 py-6">
                        <div className="relative inline-block">
                            <div className={`text-8xl ${matchResult === "won" ? "animate-bounce" : "animate-pulse"}`}>
                                {matchResult === "won" ? "🏆" : "😔"}
                            </div>
                            {matchResult === "won" && (
                                <div className="absolute -inset-8 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <h2 className={`text-3xl font-black ${matchResult === "won" ? "text-emerald-400" : "text-red-400"}`}>
                                {matchResult === "won" ? "You Won the Match!" : "You Lost the Match"}
                            </h2>
                            <p className="text-white/50 font-bold text-lg">{playerScore} – {opponentScore}</p>
                            <div className={`flex items-center gap-2 justify-center mt-2 px-4 py-2 rounded-full ${matchResult === "won" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                <Star size={16} />
                                <span className="text-sm font-bold">
                                    {matchResult === "won"
                                        ? `+${stakeAmount * 2} Stars (escrow + winnings)`
                                        : `-${stakeAmount} Stars (escrow lost)`
                                    }
                                </span>
                            </div>
                            {aiActive && (
                                <p className="text-white/30 text-xs mt-1">🤖 AI was involved in this match</p>
                            )}
                        </div>

                        {/* Round History */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-left">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">Match Summary</p>
                            {roundHistory.map((r, i) => (
                                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                    <span className="text-[10px] font-mono text-white/20 w-6">R{r.round}</span>
                                    <span className="text-lg">{choiceEmoji(r.playerChoice)}</span>
                                    <span className="text-white/20 text-xs">vs</span>
                                    <span className="text-lg">{choiceEmoji(r.opponentChoice)}</span>
                                    <span className={`text-xs font-bold ml-auto uppercase ${resultColors[r.result]}`}>{r.result}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handlePlayAgain}
                            disabled={isLoading}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 text-sm disabled:opacity-60"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                            Play Again
                        </button>
                    </div>
                )}

                {/* Countdown */}
                {phase === "countdown" && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6">
                        <div className="text-8xl font-black text-emerald-400 animate-pulse tabular-nums">
                            {countdown > 0 ? countdown : "GO!"}
                        </div>
                        <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Get ready...</p>
                    </div>
                )}

                {/* Reveal */}
                {phase === "reveal" && (
                    <div className="flex flex-col items-center py-8 space-y-6">
                        <div className="flex items-center gap-8">
                            <div className="text-center space-y-2">
                                <div className="text-7xl animate-in zoom-in-50 duration-500">{choiceEmoji(playerChoice)}</div>
                                <p className="text-xs font-bold text-white/40 uppercase">You</p>
                            </div>
                            <div className="text-white/20 font-black text-3xl">vs</div>
                            <div className="text-center space-y-2">
                                <div className="text-7xl animate-in zoom-in-50 duration-500 delay-200">{choiceEmoji(opponentChoice)}</div>
                                <p className="text-xs font-bold text-white/40 uppercase">{opponentLabel}</p>
                            </div>
                        </div>
                        {lastResult && (
                            <div className={`text-2xl font-black animate-in zoom-in-75 duration-300 ${resultColors[lastResult]}`}>
                                {resultText[lastResult]}
                            </div>
                        )}
                    </div>
                )}

                {/* Waiting for opponent */}
                {phase === "waiting" && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-in fade-in duration-300">
                        {/* Disconnect countdown bar */}
                        {disconnectCountdown !== null && disconnectCountdown > 0 && (
                            <div className="w-full max-w-xs space-y-2">
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-3">
                                    <p className="text-amber-400 font-bold text-sm">⚠️ Opponent disconnected</p>
                                    <p className="text-white/50 text-xs">AI will take over in {disconnectCountdown}s…</p>
                                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                                            style={{ width: `${(disconnectCountdown / 30) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* AI active notice */}
                        {aiActive && (
                            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 text-center space-y-2 w-full max-w-xs">
                                <p className="text-cyan-400 font-bold text-sm">🤖 AI is playing for your opponent</p>
                                <p className="text-white/50 text-xs">Your move is submitted. AI will respond now.</p>
                            </div>
                        )}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <div className="text-5xl animate-bounce">{choiceEmoji(playerChoice)}</div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center">
                                <span className="text-xs">🔒</span>
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-emerald-400">Move Locked 🔒</h3>
                            <p className="text-white/40 text-sm font-bold uppercase tracking-widest">
                                {aiActive ? "AI is thinking…" : mode === "solo" ? "Resolving..." : `${opponentLabel} is thinking…`}
                            </p>
                        </div>
                    </div>
                )}

                {/* Choice Buttons */}
                {phase === "choosing" && !matchResult && (
                    <div className="space-y-6 py-4">
                        {/* Disconnect warning during choosing */}
                        {disconnectCountdown !== null && disconnectCountdown > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-center">
                                <p className="text-amber-400 font-bold text-xs">⚠️ Opponent disconnected — AI takes over in {disconnectCountdown}s</p>
                            </div>
                        )}
                        <div className="text-center space-y-1">
                            {/* Move deadline timer */}
                            {moveTimeLeft !== null && moveTimeLeft > 0 && (
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                                    moveTimeLeft <= 10 ? 'bg-red-500/10 text-red-400 animate-pulse' : 'bg-white/5 text-white/40'
                                }`}>
                                    ⏱ {moveTimeLeft}s
                                </div>
                            )}
                            <p className="text-white/60 text-sm font-bold">Make your move!</p>
                            {mode === "friend" && opponentName && (
                                <div className="flex items-center justify-center gap-2">
                                    <p className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-wider">
                                        Playing vs {opponentLabel}
                                    </p>
                                    {((isPlayerA && match?.move_b) || (!isPlayerA && match?.move_a)) && (
                                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                            ✅ Ready
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {CHOICES.map(choice => (
                                <button
                                    key={choice.id}
                                    onClick={() => handleChoice(choice.id)}
                                    disabled={isSubmitting}
                                    className="group flex flex-col items-center gap-2 p-6 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all active:scale-90 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <span className="text-5xl group-hover:scale-110 transition-transform">{choice.emoji}</span>
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">{choice.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Round History (during game) */}
                {roundHistory.length > 0 && phase !== "matchEnd" && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">History</p>
                        {roundHistory.map((r, i) => (
                            <div key={i} className="flex items-center gap-3 py-1 border-b border-white/5 last:border-0">
                                <span className="text-[10px] font-mono text-white/20 w-6">R{r.round}</span>
                                <span className="text-base">{choiceEmoji(r.playerChoice)}</span>
                                <span className="text-white/20 text-[10px]">vs</span>
                                <span className="text-base">{choiceEmoji(r.opponentChoice)}</span>
                                <span className={`text-[10px] font-bold ml-auto uppercase ${resultColors[r.result]}`}>{r.result}</span>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
