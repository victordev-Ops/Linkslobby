'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from '@/actions/login'
import AuthForm from '@/components/AuthForm'
import { Mail, ArrowRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

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
    <div className="min-h-screen flex items-center justify-center bg-[#0f0a1e] text-white selection:bg-purple-500/30">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

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
                <h1 className="text-3xl font-black tracking-tight lowercase">welcome back 👻</h1>
                <p className="text-white/40 text-sm font-medium lowercase">enter your email to continue</p>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 ml-2">Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-white/20 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all placeholder:text-white/20 text-sm font-medium"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {message.text && message.type === 'error' && (
                  message.text === 'no_account' ? (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
                      <p className="text-amber-200 text-sm font-medium">
                        looks like you don't have an account yet 👀
                      </p>
                      <Link
                        href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                        className="inline-block text-sm font-bold text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                      >
                        sign up here →
                      </Link>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-medium text-center">
                      {message.text}
                    </div>
                  )
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? 'Sending...' : 'Send Magic Link'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="text-center">
                <p className="text-xs text-white/30 font-medium">
                  don't have an account? <Link href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-purple-400 hover:text-purple-300">sign up</Link>
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
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto ring-1 ring-green-500/50">
                <Check className="w-8 h-8 text-green-400" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black lowercase">check your mail 📬</h2>
                <p className="text-white/50 text-sm">we sent a magic link to <span className="text-white font-bold">{email}</span></p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 text-xs text-white/40 leading-relaxed font-medium">
                tip: check your spam folder if it doesn't appear within a minute.
              </div>

              <button
                onClick={() => { setEmailSent(false); setEmail(''); setMessage({ type: '', text: '' }) }}
                className="text-xs font-bold text-white/30 hover:text-white uppercase tracking-widest transition-colors"
              >
                try different email
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </AuthForm>
    </div>
  )
}
