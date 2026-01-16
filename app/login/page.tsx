'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthForm from '@/components/AuthForm'
import { Mail, Shield, Zap, CheckCircle2 } from 'lucide-react'
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
    <div className="min-h-screen flex items-center justify-center bg-white p-4" style={{ fontFamily: 'Roboto, sans-serif' }}>
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
              <div className="text-center mb-10">
                <motion.div 
                  className="inline-block mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="w-14 h-14 bg-purple-600 rounded-lg flex items-center justify-center mx-auto">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                </motion.div>
                
                <h1 className="text-3xl md:text-4xl font-medium text-slate-900 mb-3">
                  Welcome to Say
                </h1>
                <p className="text-slate-500 text-base">
                  Sign in with your email address
                </p>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <motion.div 
                  className="text-center p-4 border border-slate-200 rounded-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Shield className="w-5 h-5 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">Secure</p>
                </motion.div>
                <motion.div 
                  className="text-center p-4 border border-slate-200 rounded-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Zap className="w-5 h-5 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">Instant</p>
                </motion.div>
                <motion.div 
                  className="text-center p-4 border border-slate-200 rounded-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Mail className="w-5 h-5 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">No Password</p>
                </motion.div>
              </div>

              {/* Form */}
              <form onSubmit={handleMagicLink} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    placeholder="you@example.com"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all text-base bg-white"
                    required 
                    disabled={loading}
                  />
                </div>

                {message.text && message.type === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-lg bg-red-50 border border-red-200"
                  >
                    <p className="text-sm text-red-600">{message.text}</p>
                  </motion.div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending Magic Link...
                    </>
                  ) : (
                    'Continue with Email'
                  )}
                </button>
              </form>

              {/* Footer Info */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-center text-slate-600">
                  <span className="font-medium text-slate-900">New user?</span> Your account will be created automatically when you click the magic link.
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
                <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
              </motion.div>

              <h2 className="text-2xl font-medium text-slate-900 mb-3">
                Check your email
              </h2>
              <p className="text-slate-500 mb-2 text-base">
                We sent a magic link to
              </p>
              <p className="text-purple-600 font-medium text-lg mb-6">
                {email}
              </p>

              <div className="bg-slate-50 rounded-lg p-5 mb-6 border border-slate-200">
                <p className="text-sm text-slate-700">
                  Click the link in the email to sign in instantly. 
                  <span className="block mt-2 font-medium text-slate-900">
                    First time? Your profile will be created automatically.
                  </span>
                </p>
              </div>

              <button
                onClick={() => {
                  setEmailSent(false)
                  setEmail('')
                  setMessage({ type: '', text: '' })
                }}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Use a different email
              </button>

              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500">
                  <span className="font-medium">Tip:</span> Check your spam folder if you don't see the email within 2 minutes
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AuthForm>
    </div>
  )
}
