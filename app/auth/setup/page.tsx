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
      await setupProfile(username)
    } catch (err: any) {
      if (err.message !== 'NEXT_REDIRECT') {
        console.error('Profile setup failed:', err)
        setMessage(err.message || 'Something went wrong. Please try again.')
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      {/* Entry Animation for the Card */}
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
            This will be your unique handle on the platform. You can change this later.
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
              className="w-full px-4 py-3 border border-slate-200 rounded-xl
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         outline-none transition-all bg-slate-50 focus:bg-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
                Setting up...
              </span>
            ) : (
              'Create Profile'
            )}
          </motion.button>
        </form>

        {/* Animated Error Message */}
        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 p-4 rounded-xl text-sm font-medium text-center bg-red-50 text-red-600 border border-red-100">
                {message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
