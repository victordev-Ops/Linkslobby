'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AuthForm from '@/components/AuthForm' // Assuming you have this wrapper

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Login successful!
      // Force a hard refresh to update Server Components (Middleware)
      router.refresh() 
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <AuthForm>
        <h1 className="text-2xl font-bold mb-4">Welcome Back</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full p-2 border rounded-xl"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full p-2 border rounded-xl"
              required 
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button 
            disabled={loading}
            className="w-full bg-violet-600 text-white p-3 rounded-xl font-bold"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
      </AuthForm>
    </div>
  )
}
  
