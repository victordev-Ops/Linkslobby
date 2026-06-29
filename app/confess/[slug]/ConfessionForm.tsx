// app/confess/[slug]/ConfessionForm.tsx
'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { Lock, CheckCircle } from 'lucide-react'
import VerifiedBadge from '@/components/VerifiedBadge'

type ActionResponse = { error?: string; success?: boolean }

interface ConfessionFormClientProps {
  profileId: string
  username: string
  isPro?: boolean
  isBlocked?: boolean
  action: (profileId: string, formData: FormData) => Promise<ActionResponse>
}

export default function ConfessionForm({
  profileId,
  username,
  isPro = false,
  action,
  isBlocked = false,
}: ConfessionFormClientProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<ActionResponse | null>(null)
  const [charCount, setCharCount] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (formData: FormData) => {
    setFeedback(null)
    startTransition(async () => {
      const result = await action(profileId, formData)
      if (result.success) {
        setFeedback({ success: true })
        formRef.current?.reset()
        setCharCount(0)
      } else {
        setFeedback({ error: result.error })
      }
    })
  }

  if (feedback?.success) {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="mb-4 flex justify-center">
  <CheckCircle size={52} className="text-purple-600" strokeWidth={1.5} />
</div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Sent Successfully!</h3>
          <p className="text-slate-500 text-sm mb-8">Your secret is safe with us.</p>

          <div className="space-y-3">
            <button
              onClick={() => setFeedback(null)}
              className="w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-sm font-medium"
            >
              Send Another
            </button>

            <Link
              href="/signup"
              className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors text-left"
            >
              <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <Lock size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">Create your own link</p>
                <p className="text-purple-500 text-xs mt-0.5">Receive anonymous confessions</p>
              </div>
              <span className="text-purple-400 text-lg">✨</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 mb-5">
          <Lock size={24} />
        </div>

        <h1 className="text-xl font-semibold text-slate-900">
          Send a secret to
        </h1>

        <div className="mt-1 inline-flex items-center gap-1.5 justify-center">
          <span className="text-xl font-bold text-purple-600">{username}</span>
            {isPro && (
    <VerifiedBadge size={18} />
  )}
        </div>

        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Your identity is hidden. Be honest, be kind.
        </p>
      </div>

      <div className="h-px bg-slate-100 mx-6" />

      {/* Form */}
      <div className="px-8 py-6">
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          {feedback?.error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center">
              {feedback.error}
            </div>
          )}

          <div className="relative">
            <textarea
              name="message"
              rows={5}
              placeholder="Type your confession here..."
              className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl p-4 border border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none transition-all resize-none text-sm leading-relaxed"
              required
              minLength={1}
              maxLength={1000}
              disabled={isPending}
              onChange={(e) => setCharCount(e.target.value.length)}
            />
            <div className="absolute bottom-3 right-4 text-xs font-mono">
              <span className={charCount > 900 ? 'text-red-400' : 'text-slate-400'}>
                {charCount}
              </span>
              <span className="text-slate-300">/1000</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || charCount === 0 || isBlocked}
            className={`relative w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 overflow-hidden ${
              isBlocked
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98] disabled:opacity-50'
            }`}
          >
            <span className={`flex items-center justify-center gap-2 ${isPending ? 'opacity-0' : 'opacity-100'}`}>
              {isBlocked ? 'You have been blocked' : 'Send anonymously'}
            </span>
            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 pt-1">
            IP addresses are never stored.
          </p>
        </form>
      </div>
    </div>
  )
}
