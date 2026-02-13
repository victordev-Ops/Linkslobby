"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Star, TrendingUp, TrendingDown, Clock, ChevronDown, Loader2, Flame, Zap } from "lucide-react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"

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

export default function XPBalance() {
  const [balance, setBalance] = useState<number>(0)
  const [prevBalance, setPrevBalance] = useState<number>(0)
  const [showHistory, setShowHistory] = useState(false)
  const [transactions, setTransactions] = useState<XPTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [shouldPulse, setShouldPulse] = useState(false)
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

                // Trigger pulse animation for both increases and decreases
                if (newBalance !== oldBalance) {
                  setShouldPulse(true)
                  setTimeout(() => setShouldPulse(false), 1000)
                }
              } else {
                setBalance(currentBalance => {
                  setPrevBalance(currentBalance)
                  if (newBalance !== currentBalance) {
                    setShouldPulse(true)
                    setTimeout(() => setShouldPulse(false), 1000)
                  }
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

            // Add new transaction to the TOP of the list immediately
            setTransactions(prev => [newTransaction, ...prev])

            // Also refresh balance just in case profile update was missed or race condition
            // (But profile subscription usually handles this)
          }
        )
        .subscribe()
    }

    fetchBalance()
    fetchStreak()
    setupSubscription()

    return () => {
      mounted = false
      if (profileChannel) supabase.removeChannel(profileChannel)
      if (transactionChannel) supabase.removeChannel(transactionChannel)
    }
  }, [])

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

      // Get all daily_login transactions ordered by date desc
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

      // Count consecutive days starting from today/yesterday
      let consecutiveDays = 0
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]

      // Group logins by date
      const loginDates = new Set(
        logins.map(l => new Date(l.created_at).toISOString().split('T')[0])
      )

      // Check if logged in today or yesterday to start counting
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      if (!loginDates.has(todayStr) && !loginDates.has(yesterdayStr)) {
        setStreak(0)
        setStreakLoading(false)
        return
      }

      // Count backwards from today
      for (let i = 0; i < 60; i++) {
        const checkDate = new Date(now)
        checkDate.setDate(checkDate.getDate() - i)
        const dateStr = checkDate.toISOString().split('T')[0]

        if (loginDates.has(dateStr)) {
          consecutiveDays++
        } else if (i > 0) {
          // Allow skipping today if we haven't logged in today yet
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

      const limit = 20
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

  const handleClick = () => {
    if (!showHistory) {
      // Reset and fetch when opening
      setPage(0)
      setTransactions([])
      fetchTransactions(0, true)
    }
    setShowHistory(!showHistory)
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
    <div className="relative z-50">
      {/* Stars Balance Button */}
      <div className="relative group">
        {/* Outer glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 rounded-full blur-sm opacity-50 group-hover:opacity-70 transition-opacity"></div>

        {/* Main button */}
        <motion.button
          onClick={handleClick}
          className="relative flex items-center gap-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 px-3 py-1.5 rounded-full shadow-md overflow-hidden min-w-fit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={shouldPulse ? {
            boxShadow: [
              "0 2px 4px rgba(0,0,0,0.1)",
              "0 6px 16px rgba(249, 115, 22, 0.6)",
              "0 2px 4px rgba(0,0,0,0.1)"
            ]
          } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-25 animate-shimmer"></div>

          {/* Shine effect on balance increase */}
          <AnimatePresence>
            {shouldPulse && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-100/50 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>

          {/* Star icon with pulse dot */}
          <motion.div
            className="relative"
            animate={shouldPulse ? {
              rotate: [0, -15, 15, -15, 0],
              scale: [1, 1.3, 1]
            } : {}}
            transition={{ duration: 0.5 }}
          >
            <Star className="w-[14px] h-[14px] text-orange-900 fill-orange-900 drop-shadow-sm" strokeWidth={2} />
            <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-orange-100 rounded-full animate-pulse"></div>
          </motion.div>

          <span className="text-xs font-black text-orange-900 drop-shadow-sm tracking-tight relative z-10 whitespace-nowrap">
            {loading ? '...' : <AnimatedCounter value={balance} />}
          </span>

          {/* Streak badge */}
          {!streakLoading && streak >= 2 && (
            <span className="flex items-center gap-0.5 text-[10px] font-black text-orange-900 relative z-10 whitespace-nowrap">
              <Flame className="w-3 h-3" />
              {streak}
              {streak >= 7 && (
                <span className="ml-0.5 text-[8px] bg-orange-900/20 px-1 py-0.5 rounded-full font-black">2x</span>
              )}
            </span>
          )}

          {/* Particle burst on balance increase */}
          <AnimatePresence>
            {shouldPulse && (
              <>
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-orange-200 rounded-full"
                    initial={{
                      opacity: 1,
                      x: 0,
                      y: 0,
                      scale: 1
                    }}
                    animate={{
                      opacity: 0,
                      x: Math.cos((i / 6) * Math.PI * 2) * 30,
                      y: Math.sin((i / 6) * Math.PI * 2) * 30,
                      scale: 0
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    style={{
                      left: '50%',
                      top: '50%',
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Transaction History Modal - Mobile Bottom Sheet / Desktop Popover */}
      <AnimatePresence>
        {showHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 sm:bottom-auto sm:top-20 sm:right-4 sm:left-auto sm:w-96 max-h-[80vh] sm:max-h-[600px] bg-white dark:bg-[#1a1429] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-white/10 z-[70] overflow-hidden flex flex-col"
            >
              {/* Drag Handle (Mobile only) - Click to close */}
              <div
                className="w-full flex justify-center pt-3 pb-3 sm:hidden cursor-pointer active:opacity-70"
                onClick={() => setShowHistory(false)}
              >
                <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-white/10" />
              </div>

              {/* Header */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 opacity-10 dark:opacity-20" />
                <div className="relative p-6 px-6 pt-2 sm:pt-6 border-b border-orange-100 dark:border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                      History
                    </h3>

                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                          <AnimatedCounter value={balance} /> Stars
                        </span>
                      </div>

                      {/* Close Button */}
                      <button
                        onClick={() => setShowHistory(false)}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors sm:hidden"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed pr-8">
                    Track your earnings and spending. Earn more stars by logging in daily! 🌟
                  </p>

                  {/* Streak Info */}
                  {streak >= 1 && (
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

              {/* Transaction List */}
              <div ref={listRef} className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                {transactions.length === 0 && !loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
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
                        className="group relative overflow-hidden p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/5"
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

                    {/* Load More Trigger */}
                    {hasMore && (
                      <div className="pt-2 pb-4 flex justify-center">
                        <button
                          onClick={loadMore}
                          disabled={loadingHistory}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors flex items-center gap-2"
                        >
                          {loadingHistory ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              Show Older Activity
                              <ChevronDown className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  )
}
