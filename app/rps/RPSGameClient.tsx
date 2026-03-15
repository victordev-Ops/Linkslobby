"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowLeft, Share2, Loader2, Users, RotateCcw, Swords, Wifi, WifiOff, Monitor, UserPlus, Star } from "lucide-react"
import { toast } from "sonner"
import { earnXP, spendXP, getXPBalance } from "@/hooks/xp"

type Choice = "rock" | "paper" | "scissors" | null
type RoundResult = "win" | "lose" | "tie"
type GameMode = null | "solo" | "friend"
type MultiplayerRole = "host" | "guest" | null
type MultiplayerState = "idle" | "waiting" | "connected" | "playing"

interface RoundHistory {
    round: number
    playerChoice: Choice
    opponentChoice: Choice
    result: RoundResult
}

const CHOICES: { id: Choice; emoji: string; label: string }[] = [
    { id: "rock", emoji: "✊", label: "Rock" },
    { id: "paper", emoji: "✋", label: "Paper" },
    { id: "scissors", emoji: "✌️", label: "Scissors" },
]

const getResult = (player: Choice, opponent: Choice): RoundResult => {
    if (player === opponent) return "tie"
    if (
        (player === "rock" && opponent === "scissors") ||
        (player === "paper" && opponent === "rock") ||
        (player === "scissors" && opponent === "paper")
    ) return "win"
    return "lose"
}

const getComputerChoice = (): Choice => {
    const choices: Choice[] = ["rock", "paper", "scissors"]
    return choices[Math.floor(Math.random() * 3)]
}

interface RPSGameClientProps {
    profile: any
}

export default function RPSGameClient({ profile }: RPSGameClientProps) {
    const router = useRouter()
    const [supabase] = useState(() => createClient())

    // Game mode
    const [mode, setMode] = useState<GameMode>(null)

    // Core game state
    const [playerChoice, setPlayerChoice] = useState<Choice>(null)
    const [opponentChoice, setOpponentChoice] = useState<Choice>(null)
    const [playerScore, setPlayerScore] = useState(0)
    const [opponentScore, setOpponentScore] = useState(0)
    const [roundHistory, setRoundHistory] = useState<RoundHistory[]>([])
    const [phase, setPhase] = useState<"choosing" | "waiting" | "countdown" | "reveal" | "matchEnd">("choosing")
    const [countdown, setCountdown] = useState(3)
    const [matchResult, setMatchResult] = useState<"won" | "lost" | null>(null)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const phaseRef = useRef<string>("choosing")
    const playerHasChosenRef = useRef(false)

    // Multiplayer state
    const [multiplayerRole, setMultiplayerRole] = useState<MultiplayerRole>(null)
    const [multiplayerState, setMultiplayerState] = useState<MultiplayerState>("idle")
    const [roomId, setRoomId] = useState<string>("")
    const [opponentName, setOpponentName] = useState<string>("")
    const [joinRoomId, setJoinRoomId] = useState("")
    const [showJoinInput, setShowJoinInput] = useState(false)
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
    const opponentChoiceRef = useRef<Choice>(null)
    const hasProcessedRound = useRef(false)
    const [opponentHasChosen, setOpponentHasChosen] = useState(false)
    const [collateralPaid, setCollateralPaid] = useState(false)
    const gameStartedRef = useRef(false)
    const restoredRef = useRef(false)

    // Star balance gate state
    const [starBalance, setStarBalance] = useState<number | null>(null)
    const [stakeAmount, setStakeAmount] = useState(100)
    const [showBalanceGate, setShowBalanceGate] = useState(false)
    const [isCheckingBalance, setIsCheckingBalance] = useState(false)
    const [pendingMode, setPendingMode] = useState<'solo' | 'friend' | null>(null)

    // --- Star balance gate helpers ---
    const handleModeSelect = async (selectedMode: 'solo' | 'friend') => {
        setIsCheckingBalance(true)
        try {
            const balance = await getXPBalance()
            setStarBalance(balance)
            if (balance >= 100) {
                // Enough stars — proceed with standard 100 stake
                if (selectedMode === 'solo') {
                    startSoloWithStake(100)
                } else {
                    createRoom()
                }
            } else {
                // Not enough for 100 — show gate modal
                setPendingMode(selectedMode)
                setShowBalanceGate(true)
            }
        } catch {
            toast.error('Failed to check star balance')
        } finally {
            setIsCheckingBalance(false)
        }
    }

    const startSoloWithStake = async (stake: number) => {
        setStakeAmount(stake)
        // Deduct collateral upfront
        const res = await spendXP(stake, 'RPS solo collateral', { game: 'rps' })
        if (res.success) {
            setCollateralPaid(true)
            gameStartedRef.current = true
            setMode('solo')
            toast(`${stake} Stars locked as collateral ⭐`, { icon: '🔒' })
            // Update displayed balance
            setStarBalance(prev => prev !== null ? prev - stake : null)
        } else {
            toast.error(res.error || 'Failed to deduct stars')
        }
    }

    // --- Session persistence helpers ---
    const SESSION_KEY = 'rps_game_state'

    const saveSession = useCallback(() => {
        try {
            const state = {
                mode, playerScore, opponentScore, roundHistory, phase,
                matchResult, collateralPaid, roomId, opponentName,
                multiplayerRole, multiplayerState,
                gameStarted: gameStartedRef.current,
            }
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
        } catch { /* ignore quota errors */ }
    }, [mode, playerScore, opponentScore, roundHistory, phase, matchResult, collateralPaid, roomId, opponentName, multiplayerRole, multiplayerState])

    const clearSession = () => {
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
    }

    // Restore session on mount
    useEffect(() => {
        if (restoredRef.current) return
        restoredRef.current = true
        try {
            const raw = sessionStorage.getItem(SESSION_KEY)
            if (!raw) return
            const s = JSON.parse(raw)
            if (!s.mode) return

            // For friend mode, only restore if the match already ended
            // (can't reconnect the realtime channel after refresh)
            if (s.mode === 'friend' && s.phase !== 'matchEnd') {
                clearSession()
                return
            }

            setMode(s.mode)
            setPlayerScore(s.playerScore || 0)
            setOpponentScore(s.opponentScore || 0)
            setRoundHistory(s.roundHistory || [])
            setPhase(s.phase || 'choosing')
            setMatchResult(s.matchResult || null)
            setCollateralPaid(s.collateralPaid || false)
            setRoomId(s.roomId || '')
            setOpponentName(s.opponentName || '')
            setMultiplayerRole(s.multiplayerRole || null)
            setMultiplayerState(s.multiplayerState || 'idle')
            gameStartedRef.current = s.gameStarted || false

            if (s.mode === 'solo' && s.phase !== 'matchEnd') {
                toast('Game restored from your last session', { icon: '🔄' })
            }
        } catch { clearSession() }
    }, [])

    // Persist game state whenever key values change
    useEffect(() => {
        if (mode) saveSession()
    }, [mode, playerScore, opponentScore, roundHistory, phase, matchResult, saveSession])

    // Generate a short room code
    const generateRoomId = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        let code = ""
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
        return code
    }

    // Cleanup channel on unmount
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [supabase])

    // Keep phaseRef in sync with phase state
    useEffect(() => {
        phaseRef.current = phase
    }, [phase])

    // --- Multiplayer: Create Room ---
    const createRoom = useCallback(() => {
        const newRoomId = generateRoomId()
        setRoomId(newRoomId)
        setMultiplayerRole("host")
        setMultiplayerState("waiting")
        setMode("friend")

        const channel = supabase.channel(`rps:${newRoomId}`, {
            config: { broadcast: { self: false } }
        })

        channel
            .on("broadcast", { event: "join" }, ({ payload }) => {
                setOpponentName(payload.username || "Friend")
                setMultiplayerState("connected")
                // Tell the guest we're ready
                channel.send({
                    type: "broadcast",
                    event: "host-ready",
                    payload: { username: profile.username }
                })
                toast.success(`${payload.username || "Friend"} joined!`)
                // Deduct collateral
                if (!gameStartedRef.current) {
                    gameStartedRef.current = true
                    spendXP(100, "RPS match collateral", { game: "rps" }).then(res => {
                        if (res.success) {
                            setCollateralPaid(true)
                            toast("100 Stars locked as collateral ⭐", { icon: "🔒" })
                        }
                    }).catch(console.error)
                }
            })
            .on("broadcast", { event: "choice" }, ({ payload }) => {
                opponentChoiceRef.current = payload.choice
                setOpponentHasChosen(true)
                toast("Opponent has made their move! 🎯", { icon: "✅" })
                // If we already picked, both are ready — start countdown
                if (playerHasChosenRef.current && phaseRef.current === "waiting") {
                    setPhase("countdown")
                    setCountdown(3)
                }
            })
            .on("broadcast", { event: "play-again" }, () => {
                resetGame(true)
                toast("Opponent wants to play again!", { icon: "🔄" })
            })
            .on("broadcast", { event: "leave" }, () => {
                // After match concluded — graceful exit, no forfeit
                if (phaseRef.current === "matchEnd") {
                    toast("Opponent left the game", { icon: "👋" })
                    return
                }
                // Mid-game leave — opponent forfeited
                if (gameStartedRef.current) {
                    earnXP(200, "Opponent forfeited RPS match", { game: "rps" }, true, profile.is_pro).catch(console.error)
                    toast.success("Opponent forfeited! +200 Stars ⭐")
                } else {
                    toast.error("Opponent left the game")
                }
                setMultiplayerState("idle")
                setMode(null)
                gameStartedRef.current = false
                cleanupChannel()
            })
            .subscribe()

        channelRef.current = channel
    }, [supabase, profile.username])

    // --- Multiplayer: Join Room ---
    const joinRoom = useCallback((code: string) => {
        const trimmed = code.trim().toUpperCase()
        if (trimmed.length !== 6) {
            toast.error("Enter a valid 6-character room code")
            return
        }
        setRoomId(trimmed)
        setMultiplayerRole("guest")
        setMultiplayerState("waiting")
        setMode("friend")

        const channel = supabase.channel(`rps:${trimmed}`, {
            config: { broadcast: { self: false } }
        })

        channel
            .on("broadcast", { event: "host-ready" }, ({ payload }) => {
                setOpponentName(payload.username || "Friend")
                setMultiplayerState("connected")
                // Deduct collateral
                if (!gameStartedRef.current) {
                    gameStartedRef.current = true
                    spendXP(100, "RPS match collateral", { game: "rps" }).then(res => {
                        if (res.success) {
                            setCollateralPaid(true)
                            toast("100 Stars locked as collateral ⭐", { icon: "🔒" })
                        }
                    }).catch(console.error)
                }
            })
            .on("broadcast", { event: "choice" }, ({ payload }) => {
                opponentChoiceRef.current = payload.choice
                setOpponentHasChosen(true)
                toast("Opponent has made their move! 🎯", { icon: "✅" })
                // If we already picked, both are ready — start countdown
                if (playerHasChosenRef.current && phaseRef.current === "waiting") {
                    setPhase("countdown")
                    setCountdown(3)
                }
            })
            .on("broadcast", { event: "play-again" }, () => {
                resetGame(true)
                toast("Opponent wants to play again!", { icon: "🔄" })
            })
            .on("broadcast", { event: "leave" }, () => {
                // After match concluded — graceful exit, no forfeit
                if (phaseRef.current === "matchEnd") {
                    toast("Opponent left the game", { icon: "👋" })
                    return
                }
                // Mid-game leave — opponent forfeited
                if (gameStartedRef.current) {
                    earnXP(200, "Opponent forfeited RPS match", { game: "rps" }, true, profile.is_pro).catch(console.error)
                    toast.success("Opponent forfeited! +200 Stars ⭐")
                } else {
                    toast.error("Opponent left the game")
                }
                setMultiplayerState("idle")
                setMode(null)
                gameStartedRef.current = false
                cleanupChannel()
            })
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    // Announce arrival
                    channel.send({
                        type: "broadcast",
                        event: "join",
                        payload: { username: profile.username }
                    })
                }
            })

        channelRef.current = channel
    }, [supabase, profile.username])

    const cleanupChannel = () => {
        if (channelRef.current) {
            channelRef.current.send({ type: "broadcast", event: "leave", payload: {} })
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }
    }

    // --- Handle choice selection ---
    const handleChoice = (choice: Choice) => {
        if (phase !== "choosing" || !choice) return
        setPlayerChoice(choice)
        hasProcessedRound.current = false
        playerHasChosenRef.current = true

        if (mode === "friend" && channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "choice",
                payload: { choice }
            })

            // If opponent already picked, start countdown immediately
            if (opponentChoiceRef.current) {
                setPhase("countdown")
                setCountdown(3)
            } else {
                // Wait for opponent
                setPhase("waiting")
            }
        } else {
            // Solo: start countdown right away
            setPhase("countdown")
            setCountdown(3)
        }
    }

    // Countdown timer
    useEffect(() => {
        if (phase !== "countdown") return

        if (countdown <= 0) {
            // Resolve the round
            if (mode === "solo") {
                const cpuChoice = getComputerChoice()
                setOpponentChoice(cpuChoice)
                resolveRound(playerChoice, cpuChoice)
            } else {
                // Both have already chosen (guaranteed by waiting phase)
                const oppChoice = opponentChoiceRef.current
                if (oppChoice) {
                    setOpponentChoice(oppChoice)
                    resolveRound(playerChoice, oppChoice)
                    opponentChoiceRef.current = null
                }
            }
            return
        }

        const timer = setTimeout(() => setCountdown(c => c - 1), 600)
        return () => clearTimeout(timer)
    }, [phase, countdown, mode, playerChoice])

    // --- Resolve round ---
    const resolveRound = (pChoice: Choice, oChoice: Choice) => {
        if (hasProcessedRound.current) return
        hasProcessedRound.current = true

        const result = getResult(pChoice, oChoice)
        const roundNum = roundHistory.length + 1

        setRoundHistory(prev => [...prev, {
            round: roundNum,
            playerChoice: pChoice,
            opponentChoice: oChoice,
            result
        }])

        let newPlayerScore = playerScore
        let newOpponentScore = opponentScore

        if (result === "win") {
            newPlayerScore = playerScore + 1
            setPlayerScore(newPlayerScore)
        } else if (result === "lose") {
            newOpponentScore = opponentScore + 1
            setOpponentScore(newOpponentScore)
        }

        setPhase("reveal")
        setOpponentHasChosen(false)

        // Check for match end
        setTimeout(() => {
            if (newPlayerScore >= 3) {
                setMatchResult("won")
                setPhase("matchEnd")
                if (mode === "friend") {
                    // Won: get collateral back + opponent's collateral
                    earnXP(200, "Won Rock Paper Scissors match", { game: "rps" }, true, profile.is_pro).catch(console.error)
                } else {
                    // Solo: earn 2x stake (collateral back + winnings)
                    earnXP(stakeAmount * 2, "Won Rock Paper Scissors match", { game: "rps" }, true, profile.is_pro).catch(console.error)
                }
            } else if (newOpponentScore >= 3) {
                setMatchResult("lost")
                setPhase("matchEnd")
                // No extra deduction — collateral was already held upfront
                // Friend mode: also no extra deduction (already paid collateral)
            } else {
                // Next round
                setPhase("choosing")
                setPlayerChoice(null)
                setOpponentChoice(null)
            }
        }, 2000)
    }

    // Reset game
    const resetGame = (keepMode = false) => {
        setPlayerChoice(null)
        setOpponentChoice(null)
        setPlayerScore(0)
        setOpponentScore(0)
        setRoundHistory([])
        setPhase("choosing")
        setCountdown(3)
        setMatchResult(null)
        opponentChoiceRef.current = null
        hasProcessedRound.current = false
        setOpponentHasChosen(false)
        setCollateralPaid(false)
        gameStartedRef.current = false
        playerHasChosenRef.current = false
        clearSession()
        if (!keepMode) {
            setMode(null)
            setMultiplayerState("idle")
            setMultiplayerRole(null)
            setRoomId("")
            setOpponentName("")
            cleanupChannel()
        }
    }

    const handlePlayAgain = () => {
        if (mode === "friend" && channelRef.current) {
            channelRef.current.send({ type: "broadcast", event: "play-again", payload: {} })
        }
        resetGame(mode === "friend")
        // Re-deduct collateral for the new match
        if (mode === "friend") {
            gameStartedRef.current = true
            spendXP(100, "RPS match collateral", { game: "rps" }).then(res => {
                if (res.success) {
                    setCollateralPaid(true)
                    toast("100 Stars locked as collateral ⭐", { icon: "🔒" })
                }
            }).catch(console.error)
        }
    }

    const handleBack = () => {
        // If an active game is ongoing, warn them
        if (mode === "solo" && (playerChoice || roundHistory.length > 0) && phaseRef.current !== "matchEnd") {
            setShowExitConfirm(true)
            return
        }
        if (mode === "friend" && gameStartedRef.current && phaseRef.current !== "matchEnd") {
            setShowExitConfirm(true)
            return
        }

        // Otherwise safe to leave
        if (mode) {
            cleanupChannel()
            resetGame()
        } else {
            router.push("/dashboard")
        }
    }

    const confirmExit = () => {
        setShowExitConfirm(false)
        if (mode === "solo") {
            // Solo forfeiture
            spendXP(100, "Forfeited Rock Paper Scissors match", { game: "rps" }).catch(console.error)
            toast.error("You forfeited! -100 Stars")
        } else if (mode === "friend") {
            // Friend forfeiture (already paid collateral, opponent will get the bonus)
            toast.error("You forfeited your collateral!")
        }
        cleanupChannel()
        resetGame()
    }

    const handleShareRoom = async () => {
        const url = `${window.location.origin}/rps?join=${roomId}`
        if (navigator.share) {
            try {
                await navigator.share({ title: `Join my RPS game!`, text: `Room code: ${roomId}`, url })
            } catch { /* cancelled */ }
        } else {
            await navigator.clipboard.writeText(url)
            toast.success("Room link copied!")
        }
    }

    // Check URL params for join code on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const joinCode = params.get("join")
        if (joinCode) {
            joinRoom(joinCode)
        }
    }, [joinRoom])

    const choiceEmoji = (c: Choice) => CHOICES.find(x => x.id === c)?.emoji || "❓"
    const opponentLabel = mode === "solo" ? "Computer" : (opponentName || "Friend")

    // ─── MODE SELECTION ───
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
                    {starBalance !== null && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 rounded-full text-amber-400 text-xs font-bold">
                            <Star size={12} />
                            {starBalance}
                        </div>
                    )}
                </div>

                <main className="max-w-md mx-auto p-6 space-y-8 relative z-10 pt-12">
                    {/* Title */}
                    <div className="text-center space-y-3">
                        <div className="text-6xl animate-bounce">✊✋✌️</div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                            Rock Paper Scissors
                        </h1>
                        <p className="text-white/50 text-sm max-w-[260px] mx-auto">Best of 5 rounds. First to 3 wins!</p>
                    </div>

                    {/* Mode buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleModeSelect('solo')}
                            disabled={isCheckingBalance}
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
                            </div>
                        </button>

                        <button
                            onClick={createRoom}
                            className="w-full p-5 bg-white/5 hover:bg-teal-500/10 border border-white/10 hover:border-teal-500/30 rounded-2xl transition-all active:scale-[0.98] group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <UserPlus size={28} />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-lg text-white">Create Room</h3>
                                    <p className="text-xs text-white/40">Invite a friend to play with you</p>
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
                                    onClick={() => joinRoom(joinRoomId)}
                                    disabled={joinRoomId.length !== 6}
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                >
                                    Join
                                </button>
                            </div>
                        )}
                    </div>

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

                                {starBalance !== null && starBalance > 0 ? (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => {
                                                setStakeAmount(starBalance!)
                                                setShowBalanceGate(false)
                                                startSoloWithStake(starBalance!)
                                            }}
                                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition active:scale-95"
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

    // ─── WAITING FOR OPPONENT ───
    if (mode === "friend" && multiplayerState !== "connected" && multiplayerState !== "playing") {
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
                    <h2 className="font-bold text-sm">
                        {multiplayerRole === "host" ? "Waiting for Friend" : "Joining Room..."}
                    </h2>
                </div>

                <main className="max-w-md mx-auto p-6 pt-20 relative z-10 flex flex-col items-center text-center space-y-8">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            {multiplayerRole === "host" ? <Wifi size={40} className="text-emerald-400 animate-pulse" /> : <Loader2 size={40} className="text-emerald-400 animate-spin" />}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full animate-ping" />
                    </div>

                    {multiplayerRole === "host" ? (
                        <>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white">Share this code</h2>
                                <p className="text-sm text-white/40">Give this code to your friend to join</p>
                            </div>

                            <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-xs">
                                <p className="text-4xl font-black font-mono tracking-[0.4em] text-emerald-400 text-center">
                                    {roomId}
                                </p>
                            </div>

                            <button
                                onClick={handleShareRoom}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition active:scale-95 shadow-lg shadow-emerald-900/30"
                            >
                                <Share2 size={18} />
                                Share Invite Link
                            </button>
                        </>
                    ) : (
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-white">Connecting...</h2>
                            <p className="text-sm text-white/40">Joining room <span className="font-mono text-emerald-400">{roomId}</span></p>
                        </div>
                    )}
                </main>
            </div>
        )
    }

    // ─── GAME ARENA ───
    const currentRound = roundHistory.length + 1
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
    const lastResult = roundHistory.length > 0 ? roundHistory[roundHistory.length - 1].result : null

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
                                If you leave now, you will <span className="text-red-400 font-bold">forfeit 100 Stars</span>. Are you sure?
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
                                Leave Game
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
                                        ? (mode === "friend" ? "+200 Stars (collateral + winnings)" : "+100 Stars")
                                        : (mode === "friend" ? "-100 Stars (collateral lost)" : "-100 Stars")
                                    }
                                </span>
                            </div>
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
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 text-sm"
                        >
                            <RotateCcw size={18} />
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

                {/* Waiting */}
                {phase === "waiting" && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-in fade-in duration-300">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <div className="text-5xl animate-bounce">{choiceEmoji(playerChoice)}</div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full animate-ping" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-emerald-400">Choice Locked!</h3>
                            <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Waiting for {opponentLabel}...</p>
                        </div>
                    </div>
                )}

                {/* Choice Buttons */}
                {phase === "choosing" && !matchResult && (
                    <div className="space-y-6 py-4">
                        <div className="text-center space-y-1">
                            <p className="text-white/60 text-sm font-bold">Make your move!</p>
                            {mode === "friend" && (
                                <p className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-wider">
                                    <Wifi className="inline w-3 h-3 mr-1" />
                                    Playing vs {opponentLabel}
                                </p>
                            )}
                            {mode === "friend" && opponentHasChosen && (
                                <div className="flex items-center gap-1.5 justify-center mt-1 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 animate-in fade-in duration-300">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-400">Opponent is ready!</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {CHOICES.map(choice => (
                                <button
                                    key={choice.id}
                                    onClick={() => handleChoice(choice.id)}
                                    className="group flex flex-col items-center gap-2 p-6 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all active:scale-90 hover:scale-105"
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
