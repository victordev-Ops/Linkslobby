//app/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthForm from '@/components/AuthForm'
import { Mail, Sparkles, Shield, Zap, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [emailSent, setEmailSent] = useState(false)
  
  const supabase = createClient()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
    } else {
      setEmailSent(true)
      setMessage({ type: 'success', text: 'Check your email for the magic link!' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-200 rounded-full blur-3xl opacity-20 animate-pulse delay-1000" />
      </div>

      <AuthForm>
        <AnimatePresence mode="wait">
          {!emailSent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="text-center mb-8">
                <motion.div 
                  className="inline-block mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 mx-auto">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
                
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">
                  Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Say</span>
                </h1>
                <p className="text-slate-600 text-base leading-relaxed max-w-sm mx-auto">
                  Sign in or create your account instantly—no password needed
                </p>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <motion.div 
                  className="text-center p-3 bg-purple-50 rounded-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Shield className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-purple-900">Secure</p>
                </motion.div>
                <motion.div 
                  className="text-center p-3 bg-purple-50 rounded-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Zap className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-purple-900">Instant</p>
                </motion.div>
                <motion.div 
                  className="text-center p-3 bg-purple-50 rounded-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Mail className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-purple-900">No Password</p>
                </motion.div>
              </div>

              {/* Form */}
              <form onSubmit={handleMagicLink} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold mb-2 text-slate-900">
                    Email Address
                  </label>
                  <div className="relative">
                    <input 
                      type="email" 
                      placeholder="you@example.com"
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all text-base bg-white"
                      required 
                      disabled={loading}
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                {message.text && message.type === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-xl bg-rose-50 border border-rose-200"
                  >
                    <p className="text-sm font-medium text-rose-600">{message.text}</p>
                  </motion.div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending Magic Link...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Continue with Email
                    </>
                  )}
                </button>
              </form>

              {/* Footer Info */}
              <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs text-center text-slate-600 leading-relaxed">
                  <span className="font-semibold text-purple-900">New user?</span> Your account will be created automatically when you click the magic link in your email.
                </p>
              </div>

              <p className="text-xs text-center text-slate-400 mt-4">
                By continuing, you agree to our Terms & Privacy Policy
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="text-center py-8"
            >
              {/* Success Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mb-6"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
              </motion.div>

              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Check your email!
              </h2>
              <p className="text-slate-600 mb-2 text-base">
                We sent a magic link to
              </p>
              <p className="text-purple-600 font-bold text-lg mb-6">
                {email}
              </p>

              <div className="bg-purple-50 rounded-xl p-5 mb-6 border border-purple-100">
                <p className="text-sm text-slate-700 leading-relaxed">
                  Click the link in the email to sign in instantly. 
                  <span className="block mt-2 font-semibold text-purple-900">
                    First time? Your profile will be created automatically! ✨
                  </span>
                </p>
              </div>

              <button
                onClick={() => {
                  setEmailSent(false)
                  setEmail('')
                  setMessage({ type: '', text: '' })
                }}
                className="text-sm text-purple-600 hover:text-purple-700 font-semibold underline underline-offset-4"
              >
                Use a different email
              </button>

              <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500">
                  💡 <span className="font-semibold">Tip:</span> Check your spam folder if you don't see the email within 2 minutes
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AuthForm>
    </div>
  )
    }
