"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Star, TrendingUp, TrendingDown, Clock } from "lucide-react"
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
  const supabase = createClient()

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
                // Fallback: use functional update if old balance not available
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

      // Also subscribe to XP transactions for better real-time updates
      transactionChannel = supabase
        .channel(`xp-transactions-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'xp_transactions',
            filter: `user_id=eq.${user.id}`
          },
          async () => {
            if (!mounted) return
            // Refresh balance when a transaction is created
            const { data: profile } = await supabase
              .from('profiles')
              .select('xp_balance')
              .eq('id', user.id)
              .single()
            
            if (profile) {
              const newBalance = profile.xp_balance || 0
              // Use functional update to get current balance
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
        )
        .subscribe()
    }

    fetchBalance()
    setupSubscription()

    return () => {
      mounted = false
      if (profileChannel) supabase.removeChannel(profileChannel)
      if (transactionChannel) supabase.removeChannel(transactionChannel)
    }
  }, []) // Empty dependency array - only run once on mount

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

  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('xp_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const handleClick = () => {
    setShowHistory(!showHistory)
    if (!showHistory && transactions.length === 0) {
      fetchTransactions()
    }
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
    <div className="relative">
      {/* Stars Balance Button */}
      <div className="relative group">
        {/* Outer glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 rounded-full blur-sm opacity-50 group-hover:opacity-70 transition-opacity"></div>

        {/* Main button */}
        <motion.button
          onClick={handleClick}
          className="relative flex items-center gap-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 px-3 py-1.5 rounded-full shadow-md overflow-hidden"
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

          <span className="text-xs font-black text-orange-900 drop-shadow-sm tracking-tight relative z-10">
            {loading ? '...' : <AnimatedCounter value={balance} />}
          </span>

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

      {/* Transaction History Modal */}
      <AnimatePresence>
        {showHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/20 z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="fixed top-20 right-4 w-96 max-h-[600px] bg-white dark:bg-[#1a1429] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer"></div>
                <div className="relative p-5">
                  <h3 className="text-lg font-bold text-orange-900 mb-1 drop-shadow-sm">Stars History</h3>
                  <p className="text-sm text-orange-900/80 font-medium drop-shadow-sm">
                    Current balance: <AnimatedCounter value={balance} /> Stars
                  </p>
                </div>
              </div>

              {/* Transaction List */}
              <div className="overflow-y-auto max-h-[500px]">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-gray-400">
                    <div className="relative inline-block mb-3">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 rounded-full blur-md opacity-20"></div>
                      <Star className="relative w-12 h-12 mx-auto text-orange-400 fill-orange-400" />
                    </div>
                    <p className="text-sm font-medium">No transactions yet</p>
                    <p className="text-xs mt-1 text-slate-400 dark:text-gray-500">Start earning stars!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {transactions.map((transaction, index) => (
                      <motion.div
                        key={transaction.id}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <motion.div
                              className={`p-2 rounded-lg ${transaction.type === 'earn'
                                  ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                  : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                }`}
                              whileHover={{ scale: 1.1, rotate: 5 }}
                            >
                              {transaction.type === 'earn' ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                            </motion.div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {transaction.reason}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-slate-400 dark:text-gray-500" />
                                <p className="text-xs text-slate-500 dark:text-gray-500">
                                  {formatDate(transaction.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className={`font-bold text-sm ${transaction.type === 'earn'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                            }`}>
                            {transaction.type === 'earn' ? '+' : '-'}{Math.abs(transaction.amount).toLocaleString()}
                          </div>
                        </div>
                      </motion.div>
                    ))}
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
