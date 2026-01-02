// app/auth/setup/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { setupProfile } from '@/actions/setup-profile'

export default function SetupUsername() {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // The server action now handles:
      // 1. Session check
      // 2. Slug generation
      // 3. Database insertion
      // 4. Redirect to '/'
      await setupProfile(username)
    } catch (err: any) {
      /**
       * Note: In Next.js, redirect() throws an error to stop execution.
       * We check if the error is a redirect to avoid showing an error
       * message when the operation actually succeeded.
       */
      if (err.message !== 'NEXT_REDIRECT') {
        console.error('Profile setup failed:', err)
        setMessage(err.message || 'Something went wrong. Please try again.')
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Choose a username</h1>
        <p className="text-gray-600 mb-6 text-sm">
          This will be your unique handle on the platform.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="sr-only">
              Username
            </label>
            <input
              id="username"
              placeholder="Username"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         outline-none transition"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white py-2.5 rounded-lg font-medium
                       hover:bg-gray-800 disabled:opacity-50
                       disabled:cursor-not-allowed transition-all
                       flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0
                       C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Creating Profile...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        {message && (
          <div className="mt-4 p-3 rounded-lg text-sm text-center bg-red-50 text-red-600">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
