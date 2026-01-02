'use client'

import { useState, useEffect } from 'react'
import { signUp } from '@/actions/auth'
import AuthForm from '@/components/AuthForm'
import { Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react' // Assuming Lucide-react for icons

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
      setMessage('Check your inbox! We sent a magic link to ' + email)
      setEmail('') 
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'Failed to send magic link. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto">
        <AuthForm>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
            <p className="text-sm text-gray-600 mt-2">
              No password needed. We'll email you a login link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                placeholder="name@company.com"
                className={`w-full pl-10 pr-4 py-2 border rounded-lg outline-none transition-all
                  ${status === 'error' ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg 
                         transition-colors disabled:opacity-70 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                'Send magic link'
              )}
            </button>
          </form>

          {/* Status Messages */}
          <div aria-live="polite" className="mt-6">
            {status === 'success' && (
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-xl text-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}
          </div>
        </AuthForm>

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:underline font-semibold transition-all">
            Log in
          </a>
        </p>
      </div>
    </div>
  )
        }
        
