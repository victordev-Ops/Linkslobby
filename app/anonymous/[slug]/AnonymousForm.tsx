// app/anonymous/[slug]/AnonymousForm.tsx
'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { Lock, Send, CheckCircle } from 'lucide-react'

type ActionResponse = { error?: string; success?: boolean }

interface AnonymousFormProps {
  profileId: string
  isBlocked?: boolean
  action: (profileId: string, formData: FormData) => Promise<ActionResponse>
}

export default function AnonymousForm({ profileId, action, isBlocked = false }: AnonymousFormProps) {
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
      <div className="text-center py-4">
        <div className="mb-4 flex justify-center">
          <CheckCircle size={52} className="text-indigo-600" strokeWidth={1.5} />
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-1">Sent!</h3>
        <p className="text-gray-400 text-sm mb-8">Your identity stays hidden.</p>

        <div className="space-y-3">
          <button
            onClick={() => setFeedback(null)}
            className="w-full py-3 px-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl transition-all text-sm active:scale-95"
          >
            Send another
          </button>

          <Link
            href="/signup"
            className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 text-left"
          >
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
              <Lock size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">Create your own link</p>
              <p className="text-indigo-200 text-xs mt-0.5">Receive anonymous messages</p>
            </div>
            <span className="text-white/60">→</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      {feedback?.error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-500 text-sm text-center font-medium">
          {feedback.error}
        </div>
      )}

      <div className="relative">
        <textarea
          name="message"
          rows={5}
          placeholder="Type your message here..."
          className="w-full bg-gray-50 text-gray-900 placeholder-gray-400 rounded-2xl p-4 border border-gray-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none text-sm leading-relaxed"
          required
          minLength={1}
          maxLength={1000}
          disabled={isPending || isBlocked}
          onChange={(e) => setCharCount(e.target.value.length)}
        />
        <div className="absolute bottom-3 right-4 text-xs font-mono">
          <span className={charCount > 900 ? 'text-red-400' : 'text-gray-300'}>
            {charCount}
          </span>
          <span className="text-gray-200">/1000</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || charCount === 0 || isBlocked}
        className={`w-full py-4 rounded-2xl font-bold text-sm shadow-lg transition-all duration-200 flex items-center justify-center gap-2
          ${isBlocked
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-[0.98] disabled:opacity-50'
          }`}
      >
        {isPending ? (
          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send size={15} />
            {isBlocked ? 'You have been blocked' : 'Send anonymously'}
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400 pt-1">
        Your identity stays hidden. IP is never stored.
      </p>
    </form>
  )
        }
