'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { setupProfile } from '@/actions/setup-profile'
import { motion, AnimatePresence } from 'framer-motion'

export default function SetupUsername() {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Capture the result from the action
      const result = await setupProfile(username)

      // If the action returned an error object, display it
      if (result?.error) {
        setMessage(result.error)
        setLoading(false)
      }
      // On success, Next.js will redirect (throwing NEXT_REDIRECT), which we let propagate
    } catch (err: any) {
      // Only unexpected errors reach here (redirects are intentionally not handled)
      if (err.message !== 'NEXT_REDIRECT') {
        console.error('Unexpected profile setup error:', err)
        setMessage('An unexpected error occurred.')
        setLoading(false)
      }
      // NEXT_REDIRECT errors are ignored so the redirect can happen naturally
    }
  }

  // Clear error message when user starts typing again
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
    if (message) setMessage('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Choose a <span className="text-purple-600">username</span>
          </h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            This will be your unique handle on the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-1">
            <label htmlFor="username" className="text-sm font-semibold text-slate-700 ml-1">
              Username
            </label>
            <input
              id="username"
              placeholder="e.g. tech_enthusiast"
              className={`w-full px-4 py-3 border rounded-xl outline-none transition-all
                         bg-slate-50 focus:bg-white
                         ${message 
                           ? 'border-red-300 focus:ring-2 focus:ring-red-200' 
                           : 'border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                         }`}
              value={username}
              onChange={handleInputChange}
              required
              minLength={3}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold
                       hover:bg-purple-700 disabled:opacity-50
                       disabled:cursor-not-allowed shadow-md shadow-purple-200
                       transition-colors flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking availability...
              </span>
            ) : (
              'Create Profile'
            )}
          </motion.button>
        </form>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 p-4 rounded-xl text-sm font-medium text-center bg-red-50 text-red-600 border border-red-100 flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
                  }
