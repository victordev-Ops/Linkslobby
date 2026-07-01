'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { setupProfile, checkUsernameAvailability } from '@/actions/profile'
import { useDebounce } from '@/hooks/use-debounce'
import { motion, AnimatePresence } from 'framer-motion'
import AuthForm from '@/components/AuthForm'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { showXPNotification } from '@/components/XPNotification'
import { XP_REWARDS } from '@/hooks/xp'
import { createClient } from '@/lib/supabase/client'
import { User, Loader2, Check, X, ArrowRight } from 'lucide-react'

export default function SetupUsername() {
  return (
    <Suspense>
      <SetupUsernameContent />
    </Suspense>
  )
}

function SetupUsernameContent() {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || searchParams.get('returnTo')
  const [loading, setLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Fast session check - doesn't wait for profile
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  const debouncedUsername = useDebounce(username, 500)
  const router = useRouter()
  const { refreshProfile } = useAuth()

  // Quick session check on mount - much faster than waiting for full AuthContext
  //
  // This used to do a single synchronous getSession() check and bounce to
  // a bare '/login' if it came back empty. That raced with the auth cookies
  // set by the /auth/confirm redirect (especially on Safari/mobile), and on
  // a false negative it dropped the `next`/`returnTo` destination entirely,
  // stranding people who came from a deep link (e.g. quiz results) back on
  // the dashboard after re-logging in. This version gives the session a
  // short grace period to arrive via onAuthStateChange before giving up,
  // and always preserves `next` on the eventual redirect if it does fail.
  useEffect(() => {
    const supabase = createClient()
    let resolved = false

    const redirectToLogin = () => {
      if (resolved) return
      resolved = true
      const loginUrl = next
        ? `/login?returnTo=${encodeURIComponent(next)}`
        : '/login'
      router.replace(loginUrl)
    }

    const confirmSession = (session: unknown) => {
      if (resolved || !session) return
      resolved = true
      setHasSession(true)
      setSessionChecked(true)
    }

    // 1. Immediate check
    supabase.auth.getSession().then(({ data: { session } }) => {
      confirmSession(session)
      // If null here, don't bail yet — cookies from the /auth/confirm
      // redirect may still be propagating to the browser client.
    })

    // 2. Catch a session that arrives just after mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      confirmSession(session)
    })

    // 3. Only conclude "no session" after a short grace period
    const timeout = setTimeout(() => {
      if (!resolved) {
        setSessionChecked(true)
        setHasSession(false)
        redirectToLogin()
      }
    }, 1500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router, next])

  // Validate username availability
  useEffect(() => {
    async function validate() {
      if (debouncedUsername.length < 3) {
        setIsAvailable(null)
        setSuggestions([])
        return
      }

      setIsChecking(true)
      const res = await checkUsernameAvailability(debouncedUsername)
      setIsAvailable(res.available)
      setSuggestions(res.suggestions)
      setMessage(res.available ? '' : 'username already taken')
      setIsChecking(false)
    }
    validate()
  }, [debouncedUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAvailable || loading) return

    setLoading(true)
    setMessage('')

    try {
      const result = await setupProfile(username)

      if (result?.error) {
        setMessage(result.error)
        setLoading(false)
        return
      }

      if (result?.success) {
        const amount = result.xpAwarded ?? XP_REWARDS.PROFILE_CREATED
        showXPNotification(amount, 'Welcome to Say! 🎉')

        // Refresh profile context
        await refreshProfile()

        // Allow notification animation to play
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Navigate to next or dashboard
        const target = next || '/dashboard'
        if (target.startsWith('/')) {
          router.push(target)
        } else {
          window.location.href = target
        }
      }
    } catch (err) {
      console.error("Profile setup error:", err)
      setMessage("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  // Show loading only until session is checked (fast)
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0a1e] text-white">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm font-medium lowercase">loading...</p>
        </div>
      </div>
    )
  }

  // No session guard
  if (!hasSession) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0a1e] text-white selection:bg-purple-500/30">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      <AuthForm>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black tracking-tight lowercase">claim handle 🏷️</h1>
            <p className="text-white/40 text-sm font-medium lowercase">pick a username to get started</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 ml-2">Username</label>
              <div className="relative group">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-white/20 group-focus-within:text-purple-400 transition-colors" />
                <input
                  className={`w-full bg-white/5 border rounded-2xl py-3 pl-11 pr-10 outline-none transition-all placeholder:text-white/20 text-sm font-medium
                    ${isAvailable === true ? 'border-green-500/50 bg-green-500/5 focus:border-green-500/50' :
                      isAvailable === false ? 'border-red-500/50 bg-red-500/5 focus:border-red-500/50' :
                        'border-white/10 focus:border-purple-500/50 focus:bg-white/10'}
                  `}
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isChecking && (
                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                  )}
                  {!isChecking && isAvailable === true && (
                    <Check className="w-4 h-4 text-green-400" />
                  )}
                  {!isChecking && isAvailable === false && (
                    <X className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Username Suggestions */}
            <AnimatePresence>
              {!isAvailable && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-2">
                    suggestions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setUsername(s)}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/60
                          hover:border-purple-500/50 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            {message && (
              <div className={`p-3 rounded-xl border text-xs font-medium text-center ${message.includes('Welcome') ? 'bg-green-500/10 border-green-500/20 text-green-200' : 'bg-red-500/10 border-red-500/20 text-red-200'
                }`}>
                {message}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isAvailable || loading || isChecking}
              className="w-full bg-white text-black py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? 'Setting up...' : 'Start Playing'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </motion.div>
      </AuthForm>
    </div>
  )
}
