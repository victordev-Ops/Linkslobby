'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from '@/actions/login'
import AuthForm from '@/components/AuthForm'
import { Mail, ArrowRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import SocialAuthButtons from '@/components/SocialAuthButtons'

export default function Login() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [emailSent, setEmailSent] = useState(false)
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || searchParams.get('next') || undefined

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const result = await signIn(email, returnTo)

    if (!result.success) {
      setMessage({ type: 'error', text: result.message })
      setLoading(false)
    } else {
      setEmailSent(true)
      setMessage({ type: 'success', text: 'check your email for the magic link!' })
      setLoading(false)
    }
  }

  return (
    <AuthForm>
      <AnimatePresence mode="wait">
        {!emailSent ? (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight lowercase text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
                welcome back 👻
              </h1>
              <p className="text-slate-500 dark:text-white/40 text-sm font-medium lowercase">
                enter your email to continue
              </p>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30 ml-2">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-300 dark:text-white/20 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-11 pr-4 outline-none focus:border-purple-500/50 focus:bg-white dark:focus:bg-white/10 transition-all placeholder:text-slate-300 dark:placeholder:text-white/20 text-sm font-medium text-slate-900 dark:text-white"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {message.text && message.type === 'error' && (
                message.text === 'no_account' ? (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-center space-y-2">
                    <p className="text-amber-700 dark:text-amber-200 text-sm font-medium">
                      looks like you don't have an account yet 👀
                    </p>
                    <Link
                      href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                      className="inline-block text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline underline-offset-2 transition-colors"
                    >
                      sign up here →
                    </Link>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-red-500/10 border border-rose-200 dark:border-red-500/20 text-rose-700 dark:text-red-200 text-xs font-medium text-center">
                    {message.text}
                  </div>
                )
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-95 hover:scale-[1.02] shadow-lg shadow-purple-200 dark:shadow-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="pt-2">
              <SocialAuthButtons mode="login" next={returnTo} />
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-400 dark:text-white/30 font-medium">
                don't have an account?{' '}
                <Link
                  href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold"
                >
                  sign up
                </Link>
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-4"
          >
            <div className="w-16 h-16 bg-emerald-50 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto ring-1 ring-emerald-200 dark:ring-green-500/50">
              <Check className="w-8 h-8 text-emerald-600 dark:text-green-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold lowercase text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
                check your mail 📬
              </h2>
              <p className="text-slate-500 dark:text-white/50 text-sm">
                we sent a magic link to{' '}
                <span className="text-slate-900 dark:text-white font-bold">{email}</span>
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 text-xs text-slate-500 dark:text-white/40 leading-relaxed font-medium">
              tip: check your spam folder if it doesn't appear within a minute.
            </div>

            <button
              onClick={() => { setEmailSent(false); setEmail(''); setMessage({ type: '', text: '' }) }}
              className="text-xs font-bold text-slate-400 dark:text-white/30 hover:text-slate-900 dark:hover:text-white uppercase tracking-widest transition-colors"
            >
              try different email
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthForm>
  )
    }
      
