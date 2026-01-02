'use client'

import { useState } from 'react'
import { signUp } from '@/actions/auth'
import AuthForm from '@/components/AuthForm'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const result = await signUp(email)
      
      if (result.success) {
        setStatus('success')
        setMessage(result.message)
        setEmail('')
      } else {
        setStatus('error')
        setMessage(result.message)
      }
    } catch (err) {
      setStatus('error')
      setMessage('An unexpected error occurred.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
      {/* Framer Motion wrapper for the whole card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <AuthForm>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold mb-2 text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mb-8">
              Enter your email to receive a secure login link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading' || status === 'success'}
              />
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold hover:bg-violet-700 shadow-lg shadow-violet-200 disabled:opacity-50 transition-all flex items-center justify-center"
              disabled={status === 'loading' || status === 'success'}
            >
              {status === 'loading' ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </span>
              ) : 'Send Login Link'}
            </motion.button>
          </form>

          {/* AnimatePresence handles the smooth entrance/exit of the message */}
          <AnimatePresence mode="wait">
            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-6 p-4 rounded-xl text-sm font-medium text-center border ${
                  status === 'success' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : 'bg-rose-50 text-rose-600 border-rose-100'
                }`}
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-8 text-center text-sm text-slate-500">
            New here?{' '}
            <Link href="/signup" className="text-violet-600 hover:text-violet-700 hover:underline font-bold transition-colors">
              Create an account
            </Link>
          </p>
        </AuthForm>
      </motion.div>
    </div>
  )
            }
                  
