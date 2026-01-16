"use client"

import { useState, useEffect } from "react"
import { Copy, Check, MessageCircleQuestion, ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from 'next/link'
import { useRouter } from "next/navigation" 
import { useAuth } from "@/context/AuthContext"
import XPBalance from "@/components/XPBalance"

export default function DashboardClient() {
  const { user, profile, loading } = useAuth()
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  // 1. Safety Redirect: Handle authentication and profile setup on the client
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // If loading is done and there's no user, redirect to login
        router.push('/login')
      } else if (!profile) {
        // If user exists but profile row is missing, redirect to setup
        router.push('/auth/setup')
      }
    }
  }, [user, profile, loading, router])

  // 2. Loading State (Keep showing this if loading OR while waiting for redirect condition)
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="sr-only">Loading dashboard...</span>
      </div>
    )
  }

  // If we reach here, profile is guaranteed to exist
  const confessUrl = `https://say-app.vercel.app/confess/${profile.slug}`

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
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar with XP Balance */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
              Say
            </h2>
          </div>
          <XPBalance />
        </div>
      </div>

      {/* Main Content */}
      <div className="py-12 px-4">
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
    </div>
  )
                      }
