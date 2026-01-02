// app/auth/setup/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { setupProfile, checkUsernameAvailability } from '@/actions/setup-profile'
import { useDebounce } from '@/hooks/use-debounce.ts'
import { motion, AnimatePresence } from 'framer-motion'

export default function SetupUsername() {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const debouncedUsername = useDebounce(username, 500)

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
    if (!isAvailable) return
    setLoading(true)
    const result = await setupProfile(username)
    if (result?.error) {
      setMessage(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-10"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Claim your handle</h1>
          <p className="text-slate-500 mt-2">How should people find you?</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              className={`w-full px-5 py-4 rounded-2xl border-2 outline-none transition-all text-lg
                ${isAvailable === true ? 'border-green-500 bg-green-50/30' : 
                  isAvailable === false ? 'border-red-400 bg-red-50/30' : 'border-slate-100 bg-slate-50 focus:border-purple-500'}
              `}
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {isChecking && <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />}
              {!isChecking && isAvailable === true && <span className="text-green-500 text-xl">✓</span>}
            </div>
          </div>

          <AnimatePresence>
            {!isAvailable && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setUsername(s)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm hover:border-purple-500 hover:text-purple-600 transition-all shadow-sm"
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
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 disabled:opacity-30 disabled:grayscale transition-all"
          >
            {loading ? 'Finalizing...' : 'Get Started'}
          </button>
        </form>
      </motion.div>
    </div>
  )
  }
                 
