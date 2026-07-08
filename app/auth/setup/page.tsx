'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { setupProfile, checkUsernameAvailability } from '@/actions/profile'
import { useDebounce } from '@/hooks/use-debounce'
import { motion, AnimatePresence } from 'framer-motion'
import AuthForm from '@/components/AuthForm'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { showXPNotification } from '@/components/XPNotification'
import { XP_REWARDS } from '@/hooks/xp'
import { User, Loader2, Check, X, ArrowRight, CheckCircle2, AlertCircle, Pencil } from 'lucide-react'

// Mirrors the server-side slugify in actions/profile.ts exactly (same
// [^a-z0-9]+ -> '-' collapse, same leading/trailing-dash trim) so the
// live preview always matches what the server will actually validate.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function SetupUsername() {
  return (
    <Suspense>
      <SetupUsernameContent />
    </Suspense>
  )
}

function SetupUsernameContent() {
  // Display name — spaces allowed, not unique.
  const [username, setUsername] = useState('')
  // URL handle — unique, strict charset. Auto-derived from username unless
  // the person edits it directly, at which point it stops following
  // username changes.
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const slugInputRef = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null)
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || searchParams.get('returnTo')
  const [loading, setLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // No client-side session polling here. middleware.ts gates /auth/setup
  // using the real, server-verified session on every request, and redirects
  // to /login before this component ever mounts. If you're here, you have
  // a session — no race, no blank-page dead end.
  const router = useRouter()
  const { refreshProfile } = useAuth()

  // Keep the slug preview in sync with the display name as it's typed —
  // instant, not debounced, since it's just a local preview. Stops the
  // moment the person hand-edits the slug themselves, so their edit can't
  // get silently overwritten by the next keystroke in the username field.
  useEffect(() => {
    if (slugTouched) return
    setSlug(slugify(username))
  }, [username, slugTouched])

  const debouncedSlug = useDebounce(slug, 500)

  // Check slug availability (this is the actual unique field — the display
  // name isn't). checkUsernameAvailability() already slugifies whatever
  // it's given and checks that, so passing the current slug directly here
  // (rather than the raw username) checks exactly what will be saved,
  // regardless of whether it was auto-derived or hand-edited.
  useEffect(() => {
    let cancelled = false

    async function validate() {
      if (debouncedSlug.length < 3) {
        setIsAvailable(null)
        setSuggestions([])
        return
      }

      setIsChecking(true)
      try {
        const res = await checkUsernameAvailability(debouncedSlug)
        if (cancelled) return
        setIsAvailable(res.available)
        setSuggestions(res.suggestions)
        if (!res.available) {
          setMessageKind('error')
          setMessage('handle already taken')
        } else {
          setMessageKind(null)
          setMessage('')
        }
      } catch (err) {
        if (cancelled) return
        // A thrown error here used to leave isChecking stuck true forever
        // and the submit button permanently disabled with no explanation.
        // Now it resolves to a clear, retry-able state instead.
        console.error('Handle availability check failed:', err)
        setIsAvailable(null)
        setSuggestions([])
        setMessageKind('error')
        setMessage("couldn't check availability — try typing again")
      } finally {
        if (!cancelled) setIsChecking(false)
      }
    }
    validate()

    return () => {
      cancelled = true
    }
  }, [debouncedSlug])

  const openSlugEditor = () => {
    setIsEditingSlug(true)
    // Focus happens after the input mounts
    setTimeout(() => slugInputRef.current?.focus(), 0)
  }

  const closeSlugEditor = () => {
    setIsEditingSlug(false)
  }

  const handleSlugChange = (raw: string) => {
    setSlugTouched(true)
    // Slugify live as they type so what's shown is always exactly what
    // will be submitted — no surprises between preview and save.
    setSlug(slugify(raw))
  }

  const applySuggestion = (s: string) => {
    setSlug(s)
    setSlugTouched(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAvailable || loading) return

    setLoading(true)
    setMessage('')
    setMessageKind(null)

    try {
      const result = await setupProfile(username, slug)

      if (result?.error) {
        setMessageKind('error')
        setMessage(result.error)
        setLoading(false)
        return
      }

      if (result?.success) {
        const amount = result.xpAwarded ?? XP_REWARDS.PROFILE_CREATED
        showXPNotification(amount, 'Welcome to Linkslobby! 🎉')
        setMessageKind('success')
        setMessage('welcome to linkslobby')

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

  return (
    <AuthForm>
      <div className="text-center mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lowercase text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
          claim handle 🏷️
        </h1>
        <p className="text-slate-500 dark:text-white/40 text-sm font-medium lowercase">
          pick a name to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30 ml-2">
            Username
          </label>
          <div className="relative group">
            <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-300 dark:text-white/20 transition-colors duration-200 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400" />
            <input
              className="w-full bg-slate-50 dark:bg-white/5 pl-11 pr-4 py-3 border border-slate-200 dark:border-white/10 rounded-2xl outline-none transition-all duration-200 placeholder:text-slate-300 dark:placeholder:text-white/20 text-sm font-medium text-slate-900 dark:text-white focus:border-purple-500/50 focus:bg-white dark:focus:bg-white/10"
              placeholder="your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Live slug preview — this is the field that's actually unique.
              Tap the pencil to hand-edit it independently of the name above. */}
          {slug.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2 mt-1.5">
              {isEditingSlug ? (
                <div className="relative flex items-center">
                  <span className="text-xs font-medium text-slate-400 dark:text-white/30 mr-0.5">@</span>
                  <input
                    ref={slugInputRef}
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    onBlur={closeSlugEditor}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        closeSlugEditor()
                      }
                    }}
                    disabled={loading}
                    className={`text-xs font-bold bg-transparent border-b outline-none px-0.5 py-0.5 min-w-[80px]
                      ${isAvailable === false ? 'border-rose-400 text-rose-500' :
                        isAvailable === true ? 'border-emerald-400 text-emerald-600 dark:text-emerald-400' :
                          'border-purple-400 text-slate-700 dark:text-white/80'}`}
                    style={{ width: `${Math.max(slug.length, 4)}ch` }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openSlugEditor}
                  className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-white/40 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                >
                  <span>
                    @<span className="font-bold text-slate-500 dark:text-white/60">{slug}</span>
                  </span>
                  <Pencil className="w-3 h-3 shrink-0" />
                </button>
              )}

              {isChecking && (
                <Loader2 className="w-3 h-3 text-purple-500 animate-spin shrink-0" />
              )}
              {!isChecking && isAvailable === true && (
                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
              )}
              {!isChecking && isAvailable === false && (
                <X className="w-3 h-3 text-rose-400 shrink-0" />
              )}
            </div>
          )}
        </div>

        {/* Handle Suggestions */}
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
                    onClick={() => applySuggestion(s)}
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
