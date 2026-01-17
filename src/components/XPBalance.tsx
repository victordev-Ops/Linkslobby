"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Coins, TrendingUp, TrendingDown, Clock } from "lucide-react"
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
    fetchBalance()
    
    // Subscribe to XP changes
    const channel = supabase
      .channel('xp-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${supabase.auth.getUser().then(u => u.data.user?.id)}`
        },
        (payload) => {
          if (payload.new && 'xp_balance' in payload.new) {
            const newBalance = payload.new.xp_balance as number
            setPrevBalance(balance)
            setBalance(newBalance)
            
            // Trigger pulse animation
            if (newBalance > balance) {
              setShouldPulse(true)
              setTimeout(() => setShouldPulse(false), 1000)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [balance])

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
      {/* XP Balance Button */}
      <div className="relative group">
        {/* Outer glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 rounded-full blur-sm opacity-60 group-hover:opacity-80 transition-opacity"></div>
        
        {/* Main button */}
        <motion.button
          onClick={handleClick}
          className="relative flex items-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 px-4 py-2 rounded-full shadow-lg overflow-hidden"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={shouldPulse ? {
            boxShadow: [
              "0 4px 6px rgba(0,0,0,0.1)",
              "0 8px 20px rgba(251, 191, 36, 0.6)",
              "0 4px 6px rgba(0,0,0,0.1)"
            ]
          } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>

          {/* Shine effect on balance increase */}
          <AnimatePresence>
            {shouldPulse && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-100/50 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>

          {/* Gold coin icon with pulse dot */}
          <motion.div
            className="relative"
            animate={shouldPulse ? { 
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.2, 1]
            } : {}}
            transition={{ duration: 0.5 }}
          >
            <Coins className="w-[18px] h-[18px] text-amber-900 drop-shadow-sm" strokeWidth={2.5} />
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-yellow-200 rounded-full animate-pulse"></div>
          </motion.div>
          
          <span className="text-sm font-black text-amber-900 drop-shadow-sm tracking-tight relative z-10">
            {loading ? '...' : <AnimatedCounter value={balance} />} XP
          </span>

          {/* Particle burst on balance increase */}
          <AnimatePresence>
            {shouldPulse && (
              <>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 bg-yellow-200 rounded-full"
                    initial={{ 
                      opacity: 1,
                      x: 0,
                      y: 0,
                      scale: 1
                    }}
                    animate={{
                      opacity: 0,
                      x: Math.cos((i / 8) * Math.PI * 2) * 40,
                      y: Math.sin((i / 8) * Math.PI * 2) * 40,
                      scale: 0
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
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
              className="fixed top-20 right-4 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer"></div>
                <div className="relative p-5">
                  <h3 className="text-lg font-bold text-amber-900 mb-1 drop-shadow-sm">XP History</h3>
                  <p className="text-sm text-amber-900/80 font-medium drop-shadow-sm">
                    Current balance: <AnimatedCounter value={balance} /> XP
                  </p>
                </div>
              </div>

              {/* Transaction List */}
              <div className="overflow-y-auto max-h-[500px]">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <div className="relative inline-block mb-3">
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 rounded-full blur-md opacity-20"></div>
                      <Coins className="relative w-12 h-12 mx-auto text-amber-400" />
                    </div>
                    <p className="text-sm font-medium">No transactions yet</p>
                    <p className="text-xs mt-1 text-slate-400">Start earning XP!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.map((transaction, index) => (
                      <motion.div 
                        key={transaction.id} 
                        className="p-4 hover:bg-slate-50 transition-colors"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <motion.div 
                              className={`p-2 rounded-lg ${
                                transaction.type === 'earn' 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'bg-red-100 text-red-600'
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
                              <p className="text-sm font-medium text-slate-900">
                                {transaction.reason}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <p className="text-xs text-slate-500">
                                  {formatDate(transaction.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className={`font-bold text-sm ${
                            transaction.type === 'earn' 
                              ? 'text-green-600' 
                              : 'text-red-600'
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
