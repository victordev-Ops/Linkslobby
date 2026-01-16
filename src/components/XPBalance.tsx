"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Coins, TrendingUp, TrendingDown, Clock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface XPTransaction {
  id: string
  amount: number
  type: 'earn' | 'spend'
  reason: string
  created_at: string
  metadata?: any
}

export default function XPBalance() {
  const [balance, setBalance] = useState<number>(0)
  const [showHistory, setShowHistory] = useState(false)
  const [transactions, setTransactions] = useState<XPTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchBalance()
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
        setBalance(profile.xp_balance || 0)
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
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        <Coins className="w-5 h-5 text-purple-600" />
        <span className="font-medium text-slate-900">
          {loading ? '...' : balance.toLocaleString()}
        </span>
        <span className="text-xs text-slate-500">XP</span>
      </button>

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
              className="fixed top-20 right-4 w-96 max-h-[600px] bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              {/* Header */}
              <div className="bg-purple-600 text-white p-4">
                <h3 className="text-lg font-medium mb-1">XP History</h3>
                <p className="text-sm text-purple-100">Current balance: {balance.toLocaleString()} XP</p>
              </div>

              {/* Transaction List */}
              <div className="overflow-y-auto max-h-[500px]">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Coins className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No transactions yet</p>
                    <p className="text-xs mt-1">Start earning XP!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${
                              transaction.type === 'earn' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {transaction.type === 'earn' ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                            </div>
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
                          <div className={`font-medium text-sm ${
                            transaction.type === 'earn' 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {transaction.type === 'earn' ? '+' : '-'}{Math.abs(transaction.amount).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
