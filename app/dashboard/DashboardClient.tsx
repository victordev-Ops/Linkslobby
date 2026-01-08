// app/dashboard/DashboardClient.tsx
"use client"

import { useState, useEffect } from "react"
import { Copy, Check, MessageCircleQuestion, ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from 'next/link'
import { useRouter } from "next/navigation" // Import router
import { useAuth } from "@/context/AuthContext"

export default function DashboardClient() {
  const { profile, loading } = useAuth()
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  // Handle Missing Profile Side Effect
  useEffect(() => {
    if (!loading && !profile) {
      // If done loading but no profile, send them to setup
      router.push('/auth/setup')
    }
  }, [loading, profile, router])

  // 1. Loading State (Keep showing this if loading OR if redirecting)
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="sr-only">Loading dashboard...</span>
      </div>
    )
  }

  // 3. Construct URL dynamically
  const confessUrl = `https://say-app.vercel.app/confess/${profile.slug}`

  // ... rest of your existing component code ...
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(confessUrl)
      setCopied(true)
      toast.success("Link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
       {/* ... existing JSX ... */}
       <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 md:p-10">
          <div className="text-center space-y-10">
            
            {/* Header */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                Welcome, {profile.username}! 👋
              </h1>
              <p className="text-lg text-gray-600">
                Share your link and start receiving anonymous confessions
              </p>
            </div>

            {/* Link Section */}
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Your personal confession link
                </p>

                <div className="relative max-w-lg mx-auto">
                  <div className="p-5 bg-gray-100 rounded-2xl font-mono text-sm break-all pr-16 text-gray-800 border border-gray-300">
                    {confessUrl}
                  </div>

                  <button
                    onClick={handleCopy}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all hover:scale-105"
                  >
                    {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5 text-gray-600" />}
                  </button>
                </div>
              </div>

              {/* AMA Feature Section */}
              <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Features</h2>
                </div>

                <Link href="/ama" className="block text-left">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between group active:scale-[0.98] transition-all hover:border-purple-200 hover:bg-purple-50/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <MessageCircleQuestion size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">Create AMA Sticker</h3>
                        <p className="text-xs text-gray-500">Get a question sticker for your story</p>
                      </div>
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" size={20} />
                  </div>
                </Link>
              </div>

              <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                <p className="text-sm text-purple-800 leading-relaxed text-left">
                  Anyone with this link can send you anonymous messages. 
                  Share it with friends or add it to your bio!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
