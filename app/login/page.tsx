'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthForm from '@/components/AuthForm'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  const supabase = createClient()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // This must match your Supabase Dashboard redirect settings
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
    } else {
      setMessage({ type: 'success', text: 'Check your email for the login link!' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <AuthForm>
        <h1 className="text-2xl font-bold mb-2">Sign In</h1>
        <p className="text-slate-500 mb-6 text-sm">We'll send a magic link to your email.</p>
        
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-violet-500 transition-all"
              required 
            />
          </div>

          {message.text && (
            <p className={`text-sm p-3 rounded-lg ${
              message.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {message.text}
            </p>
          )}

          <button 
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white p-4 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
      </AuthForm>
    </div>
  )
}
