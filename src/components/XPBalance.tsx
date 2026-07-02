"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Star, Flame } from "lucide-react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { useRouter } from "next/navigation"
import { db } from '@/lib/db'

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
  const router = useRouter()
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [shouldPulse, setShouldPulse] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  // Streak state
  const [streak, setStreak] = useState(0)
  const [streakLoading, setStreakLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let profileChannel: ReturnType<typeof supabase.channel> | null = null

    // Load cached balance from Dexie immediately
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mounted) return
      db.profiles.get(user.id).then(cached => {
        if (cached && cached.xp_balance !== undefined && mounted) {
          setBalance(cached.xp_balance)
          setLoading(false)
        }
      }).catch(() => { })
    })

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

              // Update Dexie cache
              db.profiles.update(payload.new.id as string, { xp_balance: newBalance }).catch(() => { })

              if (oldBalance !== undefined) {
                setBalance(newBalance)
                if (newBalance !== oldBalance) {
                  setShouldPulse(true)
                  setTimeout(() => setShouldPulse(false), 1000)
                }
              } else {
                setBalance(currentBalance => {
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
    }

    fetchBalance()
    fetchStreak()
    setupSubscription()

    return () => {
      mounted = false
      if (profileChannel) supabase.removeChannel(profileChannel)
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
        setBalance(profile.xp_balance || 0)
        // Update Dexie cache
        db.profiles.update(user.id, { xp_balance: profile.xp_balance || 0 }).catch(() => { })
      }
      setLoading(false)
    } catch (error) {
      console.error('Error fetching XP balance:', error)
      setLoading(false)
    }
  }

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

  return (
    <div className="relative z-50">
      {/* Stars Balance Button — glassmorphic, rectangular */}
      <div className="relative group">
        {/* Soft ambient glow behind the glass panel, rectangular to match */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-400/40 via-orange-500/30 to-orange-600/40 rounded-xl blur-md opacity-60 group-hover:opacity-80 transition-opacity"></div>

        {/* Main glass panel */}
        <motion.button
          onClick={() => router.push('/stars')}
          className="relative flex items-center gap-1.5 bg-white/50 dark:bg-white/10 backdrop-blur-xl border border-white/70 dark:border-white/15 px-3 py-1.5 rounded-xl shadow-[0_2px_10px_rgba(249,115,22,0.18)] overflow-hidden min-w-fit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={shouldPulse ? {
            boxShadow: [
              "0 2px 10px rgba(249,115,22,0.18)",
              "0 6px 20px rgba(249, 115, 22, 0.45)",
              "0 2px 10px rgba(249,115,22,0.18)"
            ]
          } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Orange brand wash so the glass still reads as "stars" at a glance */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-300/25 via-orange-200/10 to-transparent pointer-events-none"></div>

          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer"></div>

          {/* Shine effect on balance increase */}
          <AnimatePresence>
            {shouldPulse && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-100/60 to-transparent"
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
            <Star className="w-[14px] h-[14px] text-orange-600 dark:text-orange-400 fill-orange-500 dark:fill-orange-400 drop-shadow-sm" strokeWidth={2} />
            <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-orange-300 rounded-full animate-pulse"></div>
          </motion.div>

          <span className="text-xs font-black text-orange-700 dark:text-orange-300 drop-shadow-sm tracking-tight relative z-10 whitespace-nowrap">
            {loading ? '...' : <AnimatedCounter value={balance} />}
          </span>

          {/* Streak badge */}
          {!streakLoading && streak >= 2 && (
            <span className="flex items-center gap-0.5 text-[10px] font-black text-orange-700 dark:text-orange-300 relative z-10 whitespace-nowrap border-l border-orange-900/10 dark:border-white/10 pl-1.5 ml-0.5">
              <Flame className="w-3 h-3" />
              {streak}
              {streak >= 7 && (
                <span className="ml-0.5 text-[8px] bg-orange-500/20 text-orange-700 dark:text-orange-300 px-1 py-0.5 rounded font-black">2x</span>
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
                    className="absolute w-1 h-1 bg-orange-400 rounded-full"
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
      `}
      </style>
    </div>
  )
}
