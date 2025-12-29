// src/components/MessageViewClient.tsx
'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
}

type Props = {
  confession: Confession
  username: string
}

export default function MessageViewClient({ confession, username }: Props) {
  const router = useRouter()

  // FIX: Handle cache invalidation when closing the message
  const handleClose = () => {
    // 1. Force a refresh of the current route context
    // This ensures that when we land back on /inbox, it fetches fresh data
    router.refresh()
    
    // 2. Navigate back to the inbox
    router.push('/inbox')
  }

  const handleReply = async () => {
    // Fixed string interpolation syntax
    const shareUrl = `${window.location.origin}/confess/${username}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Send me anonymous messages!',
          text: 'Tap to send me a message anonymously',
          url: shareUrl,
        })
      } catch (err) {
        // Fallback if user cancels share or error occurs
        console.log('Share cancelled or failed', err)
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
        alert('Link copied to clipboard!')
      } catch (err) {
        console.error('Failed to copy', err)
      }
    }
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
          onClick={handleClose} // Updated to use the smart close handler
          className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shadow-md hover:bg-gray-300 transition-colors"
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
          className="w-full bg-black text-white font-bold text-xl py-6 rounded-full flex items-center justify-center gap-4 shadow-2xl uppercase tracking-wider active:scale-95 transition-transform"
        >
          <span className="text-3xl">💬</span>
          Reply
        </button>
      </div>
    </div>
  )
}
