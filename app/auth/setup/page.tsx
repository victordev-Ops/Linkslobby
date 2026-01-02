'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setupProfile } from '@/actions/setup-profile'
const supabase = createClient()

export default function SetupUsername() {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

/*  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // 1. Update User Metadata
      const { error: metaError } = await supabase.auth.updateUser({
        data: { username },
      })
      if (metaError) throw metaError

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Authentication lost. Please login again.')

      // 2. Generate Slug (Fixed Logic)
      // Remove special chars, replace spaces with dashes
      let baseSlug = username.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-') 
        .replace(/(^-|-$)/g, '')
      
      if (!baseSlug) baseSlug = `user-${user.id.slice(0, 4)}`

      let slug = baseSlug
      let i = 0
      let isUnique = false

      // Safety: Prevent infinite loop (max 10 tries)
      while (i < 10) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()

        if (!data) {
          isUnique = true
          break
        }

        i++
        // FIX: Correct template literal syntax
        slug = `${baseSlug}-${i}`
      }

      if (!isUnique) throw new Error('Could not generate a unique username. Please try another.')

      // 3. Insert Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          username,
          slug,
        })

      if (profileError) {
        if (profileError.code === '23505') {
          setMessage('This username is already taken.')
        } else {
          throw profileError
        }
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }
*/
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setMessage('')

  try {
    await setupProfile(username)
    router.push('/dashboard')
    router.refresh()
  } catch (err: any) {
    setMessage(err.message || 'Something went wrong')
  } finally {
    setLoading(false)
  }
}
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Choose a username</h1>
        <p className="text-gray-600 mb-6 text-sm">This will be your unique handle on the platform.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="sr-only">Username</label>
            <input
              id="username"
              placeholder="Username"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              disabled={loading}
              autoComplete="off"
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                {/* Simple SVG Spinner */}
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Creating Profile...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>
        
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm text-center ${message.includes('taken') ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
          }
                    
