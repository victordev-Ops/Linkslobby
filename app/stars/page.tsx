"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Star, TrendingUp, TrendingDown, Loader2, Flame, ArrowLeft } from "lucide-react"
import { StarAmount } from "@/components/StarAmount"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import XPBalance from "@/components/XPBalance"

interface XPTransaction {
    id: string
    amount: number
    type: 'earn' | 'spend'
    reason: string
    created_at: string
    metadata?: any
}

export default function StarsPage() {
    const router = useRouter()
    const [transactions, setTransactions] = useState<XPTransaction[]>([])
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
        let transactionChannel: ReturnType<typeof supabase.channel> | null = null

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !mounted) return

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

        fetchStreak()
        fetchTransactions(0, true)
        setupSubscription()

        return () => {
            mounted = false
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
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24" style={{ fontFamily: 'var(--font-geist-sans)' }}>
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

                            <XPBalance size="lg" />
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                            Track your earnings and spending. Earn more stars by logging in daily! 🌟
                        </p>

                        {/* Streak Progress Bar */}
                        <div className="mt-4 p-4 rounded-xl border bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${streak >= 7 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'} dark:bg-white/10`}>
                                        <Flame className={`w-4 h-4 ${streak >= 7 ? 'fill-orange-500 text-orange-600' : 'text-slate-400'}`} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                            {streak >= 7 ? '2x Bonus Active!' : 'Daily Streak'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                            {streak >= 7
                                                ? 'All earnings are doubled'
                                                : `${streak}/7 days • ${7 - streak} to 2x bonus`
                                            }
                                        </span>
                                    </div>
                                </div>
                                {streak >= 7 && (
                                    <div className="px-2 py-1 rounded bg-gradient-to-r from-orange-500 to-red-600 text-white text-[10px] font-black animate-pulse shadow-lg shadow-orange-500/30">
                                        2x ACTIVE
                                    </div>
                                )}
                            </div>

                            {/* Segments */}
                            <div className="flex gap-1.5 h-3">
                                {[...Array(7)].map((_, i) => {
                                    const isFilled = i < streak
                                    const isCurrent = i === streak
                                    return (
                                        <div
                                            key={i}
                                            className={`flex-1 rounded-full relative overflow-hidden transition-all duration-500 ${isFilled
                                                    ? 'bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_10px_rgba(251,146,60,0.4)]'
                                                    : 'bg-slate-100 dark:bg-white/10'
                                                }`}
                                        >
                                            {isFilled && (
                                                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                                            )}
                                            {isCurrent && !isFilled && (
                                                <div className="absolute inset-0 bg-orange-500/20 animate-pulse" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
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
                                            <span className="shrink-0">
                                                <StarAmount amount={transaction.amount} type={transaction.type} />
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
