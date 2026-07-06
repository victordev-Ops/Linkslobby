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
import { User, Loader2, Check, X, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'

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
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null)
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
      if (!res.available) {
        setMessageKind('error')
        setMessage('username already taken')
      } else {
        setMessageKind(null)
        setMessage('')
      }
      setIsChecking(false)
    }
    validate()
  }, [debouncedUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAvailable || loading) return

    setLoading(true)
    setMessage('')
    setMessageKind(null)

    try {
      const result = await setupProfile(username)

      if (result?.error) {
        setMessageKind('error')
        setMessage(result.error)
        setLoading(false)
        return
      }

      if (result?.success) {
        const amount = result.xpAwarded ?? XP_REWARDS.PROFILE_CREATED
        showXPNotification(amount, 'Welcome to Say! 🎉')
        setMessageKind('success')
        setMessage('welcome to say! redirecting...')

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
      setMessageKind('error')
      setMessage("something went wrong. please try again.")
      setLoading(false)
    }
  }

  // Show loading only until session is checked (fast)
  if (!sessionChecked) {
    return (
      <AuthForm>
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 dark:text-white/40 text-sm font-medium lowercase">loading...</p>
        </div>
      </AuthForm>
    )
  }

  // No session guard
  if (!hasSession) return null

  return (
    <AuthForm>
      <div className="text-center mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lowercase text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
          claim handle 🏷️
        </h1>
        <p className="text-slate-500 dark:text-white/40 text-sm font-medium lowercase">
          pick a username to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30 ml-2">
            Username
          </label>
          <div className="relative group">
            <User
              className={`absolute left-4 top-3.5 h-5 w-5 transition-colors duration-200
                ${isAvailable === false ? 'text-rose-400' :
                  isAvailable === true ? 'text-emerald-500 dark:text-emerald-400' :
                    'text-slate-300 dark:text-white/20 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400'}`}
            />
            <input
              className={`w-full bg-slate-50 dark:bg-white/5 pl-11 pr-10 py-3 border rounded-2xl outline-none transition-all duration-200 placeholder:text-slate-300 dark:placeholder:text-white/20 text-sm font-medium text-slate-900 dark:text-white
                ${isAvailable === true
                  ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/5 focus:border-emerald-500'
                  : isAvailable === false
                    ? 'border-rose-500/50 focus:border-rose-500'
                    : 'border-slate-200 dark:border-white/10 focus:border-purple-500/50 focus:bg-white dark:focus:bg-white/10'}`}
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
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              )}
              {!isChecking && isAvailable === false && (
                <X className="w-4 h-4 text-rose-400" />
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
              <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest ml-2">
                suggestions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setUsername(s)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-500 dark:text-white/60
                      hover:border-purple-500/50 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={!isAvailable || loading || isChecking}
          className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-95 hover:scale-[1.02] shadow-lg shadow-purple-200 dark:shadow-purple-900/30 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              Start Playing <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Animated Status Messages */}
      <div aria-live="polite" className="mt-6 min-h-[60px]">
        <AnimatePresence mode="wait">
          {messageKind === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-200"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed lowercase">{message}</p>
            </motion.div>
          )}

          {messageKind === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-200"
            >
              <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed lowercase">{message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthForm>
  )
}
