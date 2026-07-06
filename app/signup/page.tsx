'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signUp } from '@/actions/auth'
import AuthForm from '@/components/AuthForm'
import { Loader2, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import SocialAuthButtons from '@/components/SocialAuthButtons'

export default function Signup() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || searchParams.get('next') || undefined

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
      const result = await signUp(email, returnTo)

      if (!result.success) {
        if ((result as any).alreadyExists) {
          setStatus('success')
          setMessage('account already exists! redirecting to login...')
          const loginUrl = `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`
          setTimeout(() => window.location.href = loginUrl, 2000)
          return
        }
        throw new Error(result.message)
      }

      setStatus('success')
      setMessage('check your inbox! we sent a link to ' + email)
      setEmail('')
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'failed to send link. pls try again.')
    }
  }

  return (
    <AuthForm>
      <div className="text-center mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lowercase text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
          create account 🚀
        </h1>
        <p className="text-slate-500 dark:text-white/40 text-sm font-medium lowercase">
          no password needed. just your email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30 ml-2">
            Email
          </label>
          <div className="relative group">
            <Mail
              className={`absolute left-4 top-3.5 h-5 w-5 transition-colors duration-200
                    ${status === 'error' ? 'text-rose-400' : 'text-slate-300 dark:text-white/20 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400'}`}
            />
            <input
              type="email"
              placeholder="name@company.com"
              className={`w-full bg-slate-50 dark:bg-white/5 pl-11 pr-4 py-3 border rounded-2xl outline-none transition-all duration-200 placeholder:text-slate-300 dark:placeholder:text-white/20 text-sm font-medium text-slate-900 dark:text-white
                      ${status === 'error'
                    ? 'border-rose-500/50 focus:border-rose-500'
                    : 'border-slate-200 dark:border-white/10 focus:border-purple-500/50 focus:bg-white dark:focus:bg-white/10'}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === 'loading'}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-95 hover:scale-[1.02] shadow-lg shadow-purple-200 dark:shadow-purple-900/30 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Sign Up <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="pt-2">
        <SocialAuthButtons mode="signup" next={returnTo} />
      </div>

      {/* Animated Status Messages */}
      <div aria-live="polite" className="mt-6 min-h-[60px]">
        <AnimatePresence mode="wait">
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-200"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">{message}</p>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-200"
            >
              <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">{message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-center mt-2">
        <p className="text-xs text-slate-400 dark:text-white/30 font-medium">
          already have an account?{' '}
          <Link
            href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors font-bold"
          >
            log in
          </Link>
        </p>
      </div>
    </AuthForm>
  )
}
  
