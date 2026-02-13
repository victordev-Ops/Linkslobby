"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Star, TrendingUp, TrendingDown, Loader2, Flame, ArrowLeft } from "lucide-react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { useRouter } from "next/navigation"

interface XPTransaction {
    id: string
    amount: number
    type: 'earn' | 'spend'
    reason: string
    created_at: string
    metadata?: any
}

// Animated counter component
function AnimatedCounter({ value }: { value: number }) {
    const spring = useSpring(value, {
        stiffness: 100,
        damping: 30,
        duration: 1000
    })
    const display = useTransform(spring, (current) =>
        Math.round(current).toLocaleString()
    )

    useEffect(() => {
        spring.set(value)
    }, [spring, value])

    return <motion.span>{display}</motion.span>
}

export default function StarsPage() {
    const router = useRouter()
    const [balance, setBalance] = useState<number>(0)
    const [prevBalance, setPrevBalance] = useState<number>(0)
    const [transactions, setTransactions] = useState<XPTransaction[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [loadingHistory, setLoadingHistory] = useState(false)

    const supabase = useMemo(() => createClient(), [])
    const listRef = useRef<HTMLDivElement>(null)

    // Streak state
    const [streak, setStreak] = useState(0)
    const [streakLoading, setStreakLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        let profileChannel: ReturnType<typeof supabase.channel> | null = null
        let transactionChannel: ReturnType<typeof supabase.channel> | null = null

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !mounted) return

            // Subscribe to XP changes on profiles table
            profileChannel = supabase
                .channel(`xp-changes-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'profiles',
                        filter: `id=eq.${user.id}`
                    },
                    (payload) => {
                        if (!mounted) return
                        if (payload.new && 'xp_balance' in payload.new) {
                            const newBalance = payload.new.xp_balance as number
                            const oldBalance = payload.old?.xp_balance as number

                            if (oldBalance !== undefined) {
                                setPrevBalance(oldBalance)
                                setBalance(newBalance)
                            } else {
                                setBalance(currentBalance => {
                                    setPrevBalance(currentBalance)
                                    return newBalance
                                })
                            }
                        }
                    }
                )
                .subscribe()

            // Subscribe to new transactions
            transactionChannel = supabase
                .channel(`xp-transactions-realtime-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'xp_transactions',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        if (!mounted) return
                        const newTransaction = payload.new as XPTransaction
                        setTransactions(prev => [newTransaction, ...prev])
                    }
                )
                .subscribe()
        }

        fetchBalance()
        fetchStreak()
        fetchTransactions(0, true)
        setupSubscription()

        return () => {
            mounted = false
            if (profileChannel) supabase.removeChannel(profileChannel)
            if (transactionChannel) supabase.removeChannel(transactionChannel)
        }
    }, [])

    // Infinite Scroll Observer
    const observerTarget = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loadingHistory) {
                    loadMore()
                }
            },
            { threshold: 1.0 }
        )

        if (observerTarget.current) {
            observer.observe(observerTarget.current)
        }

        return () => observer.disconnect()
    }, [hasMore, loadingHistory])

    const fetchBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('xp_balance')
                .eq('id', user.id)
                .single()

            if (profile) {
                const newBalance = profile.xp_balance || 0
                setBalance(newBalance)
                setPrevBalance(newBalance)
            }
            setLoading(false)
        } catch (error) {
            console.error('Error fetching XP balance:', error)
            setLoading(false)
        }
    }

    // Fetch login streak from xp_transactions
    const fetchStreak = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: logins, error } = await supabase
                .from('xp_transactions')
                .select('created_at')
                .eq('user_id', user.id)
                .ilike('reason', '%Daily Login%')
                .order('created_at', { ascending: false })
                .limit(60)

            if (error || !logins || logins.length === 0) {
                setStreak(0)
                setStreakLoading(false)
                return
            }

            let consecutiveDays = 0
            const now = new Date()
            const todayStr = now.toISOString().split('T')[0]

            const loginDates = new Set(
                logins.map(l => new Date(l.created_at).toISOString().split('T')[0])
            )

            const yesterday = new Date(now)
            yesterday.setDate(yesterday.getDate() - 1)
            const yesterdayStr = yesterday.toISOString().split('T')[0]

            if (!loginDates.has(todayStr) && !loginDates.has(yesterdayStr)) {
                setStreak(0)
                setStreakLoading(false)
                return
            }

            for (let i = 0; i < 60; i++) {
                const checkDate = new Date(now)
                checkDate.setDate(checkDate.getDate() - i)
                const dateStr = checkDate.toISOString().split('T')[0]

                if (loginDates.has(dateStr)) {
                    consecutiveDays++
                } else if (i > 0) {
                    break
                }
            }

            setStreak(consecutiveDays)
            setStreakLoading(false)
        } catch (error) {
            console.error('Error fetching streak:', error)
            setStreakLoading(false)
        }
    }

    const fetchTransactions = async (pageNum: number, isRefresh = false) => {
        try {
            setLoadingHistory(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const limit = 10
            const from = pageNum * limit
            const to = from + limit - 1

            const { data, error } = await supabase
                .from('xp_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) throw error

            const newTransactions = data || []

            if (isRefresh) {
                setTransactions(newTransactions)
            } else {
                setTransactions(prev => [...prev, ...newTransactions])
            }

            setHasMore(newTransactions.length === limit)
            setLoadingHistory(false)
        } catch (error) {
            console.error('Error fetching transactions:', error)
            setLoadingHistory(false)
        }
    }

    const loadMore = () => {
        const nextPage = page + 1
        setPage(nextPage)
        fetchTransactions(nextPage)
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none hidden dark:block">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-900/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-900/10 rounded-full blur-[120px]" />
            </div>

            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 opacity-5 dark:opacity-10" />
                    <div className="relative max-w-xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => router.back()}
                                    className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors active:scale-90"
                                >
                                    <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-white" />
                                </button>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                                    Stars
                                </h1>
                            </div>

                            <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 shadow-md">
                                <span className="text-xs font-black text-orange-900 drop-shadow-sm">
                                    {loading ? '...' : <AnimatedCounter value={balance} />} ⭐
                                </span>
                            </div>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                            Track your earnings and spending. Earn more stars by logging in daily! 🌟
                        </p>

                        {/* Streak Info */}
                        {!streakLoading && streak >= 1 && (
                            <div className={`mt-3 flex items-center gap-3 p-2.5 rounded-xl border ${streak >= 7
                                ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20'
                                : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10'
                                }`}>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${streak >= 7
                                    ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
                                    : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                                    }`}>
                                    <Flame className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                        {streak} Day Streak {streak >= 7 ? '🔥' : ''}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {streak >= 7
                                            ? 'Earnings are doubled! Keep it up!'
                                            : `${7 - streak} more day${7 - streak === 1 ? '' : 's'} until 2x earnings`
                                        }
                                    </p>
                                </div>
                                {streak >= 7 && (
                                    <div className="shrink-0 px-2 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black">
                                        2x
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Transaction List */}
            <div ref={listRef} className="max-w-xl mx-auto px-4 py-4 relative z-10">
                {transactions.length === 0 && !loadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="relative mb-4">
                            <div className="absolute inset-0 bg-orange-500 rounded-full blur-xl opacity-20"></div>
                            <div className="relative bg-orange-50 dark:bg-white/5 p-4 rounded-full">
                                <Star className="w-8 h-8 text-orange-400" />
                            </div>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No history yet</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">
                            Start exploring to earn your first stars!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {transactions.map((transaction, index) => (
                            <motion.div
                                key={`${transaction.id}-${index}`}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group relative overflow-hidden p-4 rounded-xl bg-white dark:bg-[#1a1429]/50 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-slate-100 dark:border-white/5 shadow-sm"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon Box */}
                                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${transaction.type === 'earn'
                                        ? 'bg-green-100/50 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                                        : 'bg-red-100/50 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                                        }`}>
                                        {transaction.type === 'earn' ? (
                                            <TrendingUp className="w-5 h-5" />
                                        ) : (
                                            <TrendingDown className="w-5 h-5" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 leading-tight">
                                                {transaction.reason}
                                            </p>
                                            <span className={`font-bold text-sm shrink-0 ${transaction.type === 'earn'
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                {transaction.type === 'earn' ? '+' : '-'}{Math.abs(transaction.amount).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                                {formatDate(transaction.created_at)}
                                            </p>
                                            {transaction.metadata?.type && (
                                                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-bold">
                                                    {transaction.metadata.type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {/* Infinite Scroll Trigger */}
                        {hasMore && (
                            <div ref={observerTarget} className="py-4 flex justify-center">
                                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                            </div>
                        )}
                    </div>
                )}

                {/* Initial loading state */}
                {loadingHistory && transactions.length === 0 && (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                    </div>
                )}
            </div>
        </div>
    )
}
