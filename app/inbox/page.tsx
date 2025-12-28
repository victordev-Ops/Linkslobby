// app/inbox/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2 } from 'lucide-react'

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
      if (!user) return router.push('/dashboard')

      // Get username for share link
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      setUsername(profile?.username || '')

      // Fetch message
      const { data, error } = await supabase
        .from('confessions')
        .select('*')
        .eq('id', messageId)
        .single()

      if (error || !data || data.profile_id !== user.id) {
        router.push('/inbox')
        return
      }

      setConfession(data)
      setLoading(false)

      // Mark as read
      if (!data.is_read) {
        await supabase
          .from('confessions')
          .update({ is_read: true })
          .eq('id', messageId)

        // Important: refresh parent page so unread badge disappears
        router.refresh()
      }
    }

    fetchData()
  }, [messageId, router])

  const handleShare = async () => {
    const shareUrl = `https://yourdomain.com/${username}` // CHANGE THIS
    const text = 'Send me anonymous messages 👀'

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl, text })
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl)
      alert('Link copied!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar - exactly like NGL */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-2xl">⚠️</div>
          </div>
          <div className="flex -space-x-3">
            <div className="w-10 h-10 bg-gray-300 border-2 border-white rounded-full flex items-center justify-center">📷</div>
            <div className="w-10 h-10 bg-gray-400 border-2 border-white rounded-full flex items-center justify-center">👻</div>
            <div className="w-10 h-10 bg-gray-500 border-2 border-white rounded-full flex items-center justify-center">💬</div>
          </div>
        </div>
        <button onClick={() => router.back()} className="text-2xl">✕</button>
      </div>

      {/* Main message card - gradient top */}
      <div className="flex-1 flex items-start justify-center px-6 mt-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl overflow-hidden shadow-2xl">
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 px-8 py-10 text-center">
              <h1 className="text-white text-2xl font-bold tracking-wider">
                send me anonymous messages!
              </h1>
            </div>

            {/* Message body */}
            <div className="bg-white px-8 py-12 text-center">
              <p className="text-gray-800 text-xl leading-relaxed">
                {confession?.message || 'No message'}
              </p>
            </div>
          </div>

          {/* Bottom icons (color wheel + camera) */}
          <div className="flex justify-center gap-8 mt-10">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center shadow-lg">
              <div className="w-10 h-10 bg-gradient-to-tr from-red-500 via-yellow-500 to-blue-500 rounded-full" />
            </div>
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center shadow-lg">
              <div className="text-3xl">📷</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section: "Who sent this" + Reply button */}
      <div className="px-6 pb-8 mt-auto">
        <div className="bg-red-500 text-white text-center py-4 rounded-full font-semibold mb-4 shadow-lg">
          Who sent this 👀 👀
        </div>

        <button
          onClick={handleShare}
          className="w-full bg-black text-white font-semibold py-5 rounded-full flex items-center justify-center gap-3 shadow-2xl text-lg"
        >
          <div className="text-2xl">💬</div>
          reply
        </button>
      </div>
    </div>
  )
          }
