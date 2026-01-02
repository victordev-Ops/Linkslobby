'use client'

import { useState } from 'react'
import { signUp } from '@/actions/auth'
import AuthForm from '@/components/AuthForm'
import Link from 'next/link'

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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <AuthForm>
        <h1 className="text-2xl font-bold mb-2 text-center">Welcome back</h1>
        <p className="text-sm text-gray-600 mb-8 text-center">
          Enter your email to receive a secure login link.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="name@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === 'loading' || status === 'success'}
          />
          <button 
            type="submit" 
            className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-all"
            disabled={status === 'loading' || status === 'success'}
          >
            {status === 'loading' ? 'Sending Link...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-3 rounded-md text-sm text-center ${status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {message}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-gray-600">
          New here?{' '}
           {/* Use Next.js Link for client-side navigation */}
          <Link href="/signup" className="text-blue-600 hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </AuthForm>
    </div>
  )
        }
          
