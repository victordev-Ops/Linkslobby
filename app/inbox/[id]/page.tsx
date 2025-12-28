// app/inbox/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2 } from 'lucide-react'

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
}

export default function MessageViewPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [confession, setConfession] = useState<Confession | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUsername, setCurrentUsername] = useState<string>('')

  const messageId = params.id as string

  // Fetch message + profile (for share link)
  useEffect(() => {
    const fetchMessage = async () => {
      if (!messageId) return

      // Get current user to verify ownership and get username
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/dashboard')
        return
      }

      // Fetch profile to get username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      if (profile?.username) {
        setCurrentUsername(profile.username)
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
      }
    }

    fetchMessage()
  }, [messageId, router])

  // Share handler – shares your NGL link so people can reply
  const handleShare = async () => {
    const shareUrl = `https://yourdomain.com/${currentUsername}` // Replace with your actual domain
    const text = `Send me anonymous messages! 👀`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Send me anonymous messages',
          text,
          url: shareUrl,
        })
      } catch (err) {
        // User canceled or not supported
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl)
      alert('Link copied! Share it anywhere to get replies 📋')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-6" />
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto" />
        </div>
      </div>
    )
  }

  if (!confession) {
    return null // Redirected already
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between z-10">
        <button onClick={() => router.push('/inbox')} className="p-2">
          <ArrowLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="text-lg font-semibold">Message</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Main message content – NGL style */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-md w-full text-center">
          {/* Optional: small envelope icon above */}
          <div className="mb-10">
            <div className="inline-flex p-5 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full shadow-xl">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
          </div>

          {/* The actual message */}
          <p className="text-2xl leading-relaxed text-gray-900 px-4">
            {confession.message || '(No message)'}
          </p>

          {/* Optional timestamp below */}
          <p className="text-sm text-gray-500 mt-8">
            Received just now
          </p>
        </div>
      </div>

      {/* Bottom reply/share button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-6">
        <button
          onClick={handleShare}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg py-4 rounded-full shadow-lg flex items-center justify-center gap-3 hover:opacity-90 transition"
        >
          <Share2 size={22} />
          Reply on Social Media
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Share your link to get more messages
        </p>
      </div>
    </div>
  )
    }
