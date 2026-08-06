// app/three-words/ThreeWordsClient.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Copy, Check, Share2, Type, Loader2,
  MessageSquareOff, Flag, Trash2, MoreVertical,
} from 'lucide-react'
import {
  startThreeWordSession,
  getThreeWordResponses,
  markThreeWordResponseRead,
  deleteThreeWordResponse,
  reportThreeWordResponse,
} from '@/actions/three-word'

interface ThreeWordResponse {
  id: string
  words: string
  created_at: string
  is_read: boolean
  sender_id: string | null
}

interface ThreeWordSession {
  id: string
  slug: string
  status: string
  created_at: string
}

interface ThreeWordsClientProps {
  profileSlug: string
  initialSession: ThreeWordSession | null
  initialResponses: ThreeWordResponse[]
  initialNextCursor: string | null
}

export default function ThreeWordsClient({
  profileSlug,
  initialSession,
  initialResponses,
  initialNextCursor,
}: ThreeWordsClientProps) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [responses, setResponses] = useState(initialResponses)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [copied, setCopied] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [isStarting, startStarting] = useTransition()
  const [isLoadingMore, startLoadingMore] = useTransition()
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const shareUrl = session ? `https://www.linkslobby.com/three-words/${session.slug}` : null

  const handleStart = () => {
    startStarting(async () => {
      const result = await startThreeWordSession()
      if (result.success && result.slug) {
        setSession({ id: '', slug: result.slug, status: 'active', created_at: new Date().toISOString() })
        toast.success('Your link is live!')
        // TODO(analytics): track('Game Started', { game: 'three_word' })
      } else {
        toast.error(result.error || 'Could not start the game')
      }
    })
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Link copied!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleNativeShare = async () => {
    if (!shareUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl, title: 'Describe me in exactly 3 words!' })
        // TODO(analytics): track('Link Shared', { game: 'three_word', method: 'native' })
      } else {
        await handleCopy()
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Failed to share')
    }
  }

  const shareTargets = shareUrl
    ? [
        { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`Describe me in exactly 3 words! ${shareUrl}`)}` },
        { label: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent('Describe me in exactly 3 words!')}&url=${encodeURIComponent(shareUrl)}` },
        { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
        { label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Describe me in exactly 3 words!')}` },
      ]
    : []

  const handleLoadMore = () => {
    if (!nextCursor) return
    startLoadingMore(async () => {
      const result = await getThreeWordResponses(nextCursor)
      setResponses(prev => [...prev, ...result.responses])
      setNextCursor(result.nextCursor)
    })
  }

  const handleMarkRead = async (id: string) => {
    setResponses(prev => prev.map(r => (r.id === id ? { ...r, is_read: true } : r)))
    await markThreeWordResponseRead(id)
  }

  const handleDelete = async (id: string) => {
    setPendingActionId(id)
    const result = await deleteThreeWordResponse(id)
    setPendingActionId(null)
    setOpenMenuId(null)
    if (result.success) {
      setResponses(prev => prev.filter(r => r.id !== id))
      toast.success('Response deleted')
    } else {
      toast.error(result.error || 'Failed to delete')
    }
  }

  const handleReport = async (id: string) => {
    setPendingActionId(id)
    const result = await reportThreeWordResponse(id)
    setPendingActionId(null)
    setOpenMenuId(null)
    toast[result.success ? 'success' : 'error'](result.success ? 'Thanks, we\'ll review it' : (result.error || 'Failed to report'))
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0a1e]/80 backdrop-blur-md border-b border-slate-100 dark:border-white/10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} className="text-slate-600 dark:text-white/70" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Type size={16} />
          </div>
          <h1 className="font-bold text-slate-900 dark:text-white text-base">Three Word Game</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Share card */}
        <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-5 space-y-4">
          {!session ? (
            <div className="text-center py-4">
              <p className="text-slate-500 dark:text-white/60 text-sm mb-4">
                Start a session to get your shareable link.
              </p>
              <button
                onClick={handleStart}
                disabled={isStarting}
                className="w-full py-3 bg-cyan-600 text-white font-bold rounded-xl text-sm hover:bg-cyan-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isStarting ? <Loader2 size={16} className="animate-spin" /> : <Type size={16} />}
                {isStarting ? 'Starting...' : 'Start New Session'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/10">
                <p className="flex-1 min-w-0 truncate text-sm text-slate-600 dark:text-white/70 font-mono">
                  {shareUrl}
                </p>
                <button
                  onClick={handleCopy}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-50 transition-colors"
                  aria-label="Copy link"
                >
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-slate-500 dark:text-white/60" />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleNativeShare}
                  className="py-2.5 bg-cyan-600 text-white font-semibold rounded-xl text-xs hover:bg-cyan-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Share2 size={14} />
                  Share
                </button>
                <Link
                  href={shareTargets[0]?.href ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 font-semibold rounded-xl text-xs hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  WhatsApp
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {shareTargets.slice(1).map(target => (
                  <a
                    key={target.label}
                    href={target.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-cyan-600 dark:text-cyan-400 px-3 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 transition-colors"
                  >
                    {target.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Responses */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-white/40 px-1">
            Responses {responses.length > 0 && `(${responses.length})`}
          </h2>

          {responses.length === 0 ? (
            <div className="bg-white dark:bg-[#1a1429]/50 rounded-2xl border border-slate-100 dark:border-white/10 p-8 text-center">
              <MessageSquareOff size={28} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
              <p className="text-slate-400 dark:text-white/50 text-sm">
                No responses yet — share your link to get started.
              </p>
            </div>
          ) : (
            responses.map(response => (
              <div
                key={response.id}
                onClick={() => !response.is_read && handleMarkRead(response.id)}
                className={`relative bg-white dark:bg-[#1a1429]/50 rounded-2xl border p-4 transition-colors ${
                  response.is_read
                    ? 'border-slate-100 dark:border-white/10'
                    : 'border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/40 dark:bg-cyan-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
                    {response.words}
                  </p>
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === response.id ? null : response.id) }}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                      aria-label="More options"
                    >
                      <MoreVertical size={14} className="text-slate-400" />
                    </button>
                    {openMenuId === response.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-8 z-10 w-36 bg-white dark:bg-[#1a1429] rounded-xl border border-slate-100 dark:border-white/10 shadow-lg overflow-hidden"
                      >
                        <button
                          onClick={() => handleReport(response.id)}
                          disabled={pendingActionId === response.id}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <Flag size={13} /> Report
                        </button>
                        <button
                          onClick={() => handleDelete(response.id)}
                          disabled={pendingActionId === response.id}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/30 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                    Anonymous
                  </span>
                  <span className="text-xs text-slate-400 dark:text-white/40">
                    {new Date(response.created_at).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}

          {nextCursor && (
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full py-3 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
