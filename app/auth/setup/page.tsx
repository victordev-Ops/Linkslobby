//app/auth/setup/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { setupProfile, checkUsernameAvailability } from '@/actions/setup-profile'
import { useDebounce } from '@/hooks/use-debounce'
import { motion, AnimatePresence } from 'framer-motion'
import AuthForm from '@/components/AuthForm'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function SetupUsername() {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const debouncedUsername = useDebounce(username, 500)
  const router = useRouter()
  const { refreshProfile } = useAuth()

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
      setMessage(res.available ? '' : 'Username already taken')
      setIsChecking(false)
    }
    validate()
  }, [debouncedUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAvailable || loading) return
    setLoading(true)
    
    // Call the server action
    const result = await setupProfile(username)
    
    if (result?.error) {
      setMessage(result.error)
      setLoading(false)
    } else if (result?.success) {
      // CRITICAL FIX: Refresh context BEFORE navigating
      // This ensures the Dashboard Client doesn't bounce us back here
      await refreshProfile()
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <AuthForm>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Claim your handle</h1>
          <p className="text-slate-500 mt-2">Pick a username to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              className={`w-full px-5 py-4 rounded-2xl border-2 outline-none transition-all text-lg
                ${isAvailable === true ? 'border-emerald-500 bg-emerald-50/30' : 
                  isAvailable === false ? 'border-rose-400 bg-rose-50/30' : 'border-slate-100 bg-slate-50 focus:border-violet-500'}
              `}
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {isChecking && <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
              {!isChecking && isAvailable === true && <span className="text-emerald-500 font-bold">✓</span>}
            </div>
          </div>

          <AnimatePresence>
            {!isAvailable && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setUsername(s)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm hover:border-violet-500 hover:text-violet-600 transition-all shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {message && !isAvailable && <p className="text-rose-500 text-sm font-medium">{message}</p>}

          <button
            type="submit"
            disabled={!isAvailable || loading || isChecking}
            className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold text-lg hover:bg-violet-700 disabled:opacity-30 transition-all shadow-lg shadow-violet-200"
          >
            {loading ? 'Setting things up...' : 'Complete Signup'}
          </button>
        </form>
      </AuthForm>
    </div>
  )
            }
      
