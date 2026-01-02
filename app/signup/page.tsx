'use client'

import { useState, useEffect } from 'react'
import { signUp } from '@/actions/auth'
import AuthForm from '@/components/AuthForm'
import { Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // Clear message when user starts typing again
  useEffect(() => {
    if (status === 'error') {
      setStatus('idle')
      setMessage('')
    }
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      await signUp(email)
      setStatus('success')
      setMessage('Check your inbox! We sent a link to ' + email)
      setEmail('') 
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'Failed to send magic link. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full mx-auto"
      >
        <AuthForm>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create account</h1>
            <p className="text-sm text-slate-500 mt-2">
              No password needed. We'll email you a secure link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 
                ${status === 'error' ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-violet-500'}`} 
              />
              <input
                type="email"
                placeholder="name@company.com"
                className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none transition-all duration-200
                  ${status === 'error' 
                    ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-500' 
                    : 'border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent'}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 px-4 rounded-xl 
                         shadow-lg shadow-violet-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                'Sign Up'
              )}
            </motion.button>
          </form>

          {/* Animated Status Messages */}
          <div aria-live="polite" className="mt-6">
            <AnimatePresence mode="wait">
              {status === 'success' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{message}</p>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800"
                >
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AuthForm>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-violet-600 hover:text-violet-700 font-bold transition-colors">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  )
              }
        
