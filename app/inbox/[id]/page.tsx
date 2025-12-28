// app/inbox/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { X } from 'lucide-react'

export default function MessageViewPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [confession, setConfession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')

  const messageId = params.id as string

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/dashboard')
        return
      }

      // Fetch profile for share link
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, slug')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username || profile.slug || 'you')
      }

      // Fetch the specific confession
      const { data, error } = await supabase
        .from('confessions')
        .select('id, message, created_at, is_read, profile_id')
        .eq('id', messageId)
        .single()

      if (error || !data || data.profile_id !== user.id) {
        router.push('/inbox')
        return
      }

      setConfession(data)
      setLoading(false)

      // Mark as read if not already
      if (!data.is_read) {
        await supabase
          .from('confessions')
          .update({ is_read: true })
          .eq('id', messageId)

        // This triggers the BottomNavbar badge to update
        router.refresh()
      }
    }

    if (messageId) fetchData()
  }, [messageId, router, supabase])

  const handleReply = async () => {
    const shareUrl = `\( {window.location.origin}/confess/ \){username}`
    const text = `Send me anonymous messages! 👀\n${shareUrl}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Send me anonymous messages!',
          text: 'Tap to send me a message anonymously',
          url: shareUrl,
        })
      } catch (err) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl)
        alert('Link copied to clipboard!')
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      alert('Link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-purple-600 rounded-full border-t-transparent" />
      </div>
    )
  }

  if (!confession) {
    return null
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Bar - NGL Style */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md">
            !
          </div>
          <div className="flex -space-x-3">
            <div className="w-10 h-10 bg-gray-200 border-4 border-white rounded-full flex items-center justify-center text-lg shadow-md">📸</div>
            <div className="w-10 h-10 bg-gray-300 border-4 border-white rounded-full flex items-center justify-center text-lg shadow-md">👻</div>
            <div className="w-10 h-10 bg-gray-400 border-4 border-white rounded-full flex items-center justify-center text-lg shadow-md">💬</div>
          </div>
        </div>

        <button
          onClick={() => router.push('/inbox')}
          className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shadow-md"
        >
          <X size={24} className="text-gray-700" />
        </button>
      </div>

      {/* Main Message Card */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 mt-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl overflow-hidden shadow-2xl bg-white">
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 px-10 py-12 text-center">
              <h1 className="text-white text-2xl font-extrabold tracking-wide uppercase">
                Send me anonymous messages!
              </h1>
            </div>

            {/* Message Content */}
            <div className="px-10 py-16 text-center bg-white">
              <p className="text-gray-800 text-2xl leading-relaxed font-medium">
                "{confession.message}"
              </p>
            </div>
          </div>

          {/* Color & Camera Icons */}
          <div className="flex justify-center gap-10 mt-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center shadow-xl">
              <div className="w-12 h-12 bg-gradient-to-tr from-purple-500 via-pink-500 to-red-500 rounded-full" />
            </div>
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center shadow-xl text-4xl">
              📷
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="px-6 pb-10 mt-auto space-y-4">
        <div className="bg-red-500 text-white text-center py-5 rounded-full font-bold text-lg shadow-2xl tracking-wider">
          Who sent this 👀 👀
        </div>

        <button
          onClick={handleReply}
          className="w-full bg-black text-white font-bold text-xl py-6 rounded-full flex items-center justify-center gap-4 shadow-2xl uppercase tracking-wider"
        >
          <span className="text-3xl">💬</span>
          Reply
        </button>
      </div>
    </div>
  )
            }
