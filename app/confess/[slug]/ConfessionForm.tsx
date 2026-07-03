// app/confess/[slug]/ConfessionForm.tsx
'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Lock, CheckCircle, Sparkles } from 'lucide-react'
import VerifiedBadge from '@/components/VerifiedBadge'
import { toGraphemes } from '@/lib/graphemes'

type ActionResponse = { error?: string; success?: boolean }

interface ConfessionFormClientProps {
  profileId: string
  username: string
  isPro?: boolean
  isBlocked?: boolean
  action: (profileId: string, formData: FormData) => Promise<ActionResponse>
}

const MAX_CHARS = 1000

// Rotating hints shown as an animated, typewriter-style placeholder —
// same pattern used on the anonymous-message and AMA forms.
const SUGGESTIONS = [
  "I've never told anyone this, but...",
  "Something I regret is...",
  "The truth is, I actually...",
  "No one knows that I...",
  "Honestly? I've always wanted to say...",
  "This has been on my chest for a while...",
]

export default function ConfessionForm({
  profileId,
  username,
  isPro = false,
  action,
  isBlocked = false,
}: ConfessionFormClientProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<ActionResponse | null>(null)
  const [message, setMessage] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [wasTruncated, setWasTruncated] = useState(false)
  const [placeholderText, setPlaceholderText] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const isEmpty = charCount === 0
  const isNearLimit = charCount > 900

  // Typewriter loop: types a suggestion, holds, erases it, moves to the next.
  // Runs continuously until the sender starts typing their own confession.
  useEffect(() => {
    if (!isEmpty) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>
    let msgIndex = 0

    const typeMessage = () => {
      const text = SUGGESTIONS[msgIndex % SUGGESTIONS.length]
      let charIndex = 0

      const typeChar = () => {
        if (cancelled) return
        if (charIndex <= text.length) {
          setPlaceholderText(text.slice(0, charIndex))
          charIndex++
          timeoutId = setTimeout(typeChar, 45)
        } else {
          timeoutId = setTimeout(eraseMessage, 1400)
        }
      }
      typeChar()
    }

    const eraseMessage = () => {
      const text = SUGGESTIONS[msgIndex % SUGGESTIONS.length]
      let charIndex = text.length

      const eraseChar = () => {
        if (cancelled) return
        if (charIndex >= 0) {
          setPlaceholderText(text.slice(0, charIndex))
          charIndex--
          timeoutId = setTimeout(eraseChar, 22)
        } else {
          msgIndex++
          timeoutId = setTimeout(typeMessage, 350)
        }
      }
      eraseChar()
    }

    typeMessage()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [isEmpty])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const graphemes = toGraphemes(value)

    if (graphemes.length > MAX_CHARS) {
      // Hard stop at the limit, trimmed on grapheme boundaries so a compound
      // emoji at the cutoff is kept whole or dropped whole, never split.
      const trimmed = graphemes.slice(0, MAX_CHARS).join('')
      setMessage(trimmed)
      setCharCount(MAX_CHARS)
      setWasTruncated(true)
    } else {
      setMessage(value)
      setCharCount(graphemes.length)
      setWasTruncated(false)
    }
  }

  const handleSubmit = (formData: FormData) => {
    // Catch whitespace-only confessions before the round trip.
    if (message.trim().length === 0) {
      setFeedback({ error: 'Write something before sending.' })
      return
    }

    setFeedback(null)
    startTransition(async () => {
      const result = await action(profileId, formData)
      if (result.success) {
        setFeedback({ success: true })
        formRef.current?.reset()
        setMessage('')
        setCharCount(0)
        setWasTruncated(false)
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
            <div className="relative">
              <CheckCircle size={52} className="text-purple-600 animate-pop-in" strokeWidth={1.5} />
              <Sparkles size={18} className="absolute -top-1 -right-2 text-amber-400 animate-sparkle" />
              <Sparkles size={12} className="absolute -bottom-1 -left-3 text-purple-400 animate-sparkle [animation-delay:0.3s]" />
            </div>
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

        <style jsx>{`
          @keyframes pop-in {
            0% { transform: scale(0.4); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); }
          }
          :global(.animate-pop-in) {
            animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }

          @keyframes sparkle {
            0%, 100% { transform: scale(0.8) rotate(0deg); opacity: 0.6; }
            50% { transform: scale(1.2) rotate(15deg); opacity: 1; }
          }
          :global(.animate-sparkle) {
            animation: sparkle 1.6s ease-in-out infinite;
          }
        `}</style>
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
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center"
            >
              {feedback.error}
            </div>
          )}

          <div className="relative">
            <textarea
              name="message"
              rows={5}
              value={message}
              placeholder={placeholderText}
              aria-describedby={wasTruncated ? 'confession-limit-notice' : undefined}
              className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl p-4 border border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none transition-all resize-none text-sm leading-relaxed"
              required
              minLength={1}
              disabled={isPending || isBlocked}
              onChange={handleChange}
            />
            <div className="absolute bottom-3 right-4 text-xs font-mono">
              <span className={isNearLimit ? 'text-red-400' : 'text-slate-400'}>
                {charCount}
              </span>
              <span className="text-slate-300">/{MAX_CHARS}</span>
            </div>
          </div>

          {wasTruncated && (
            <p id="confession-limit-notice" role="status" className="text-xs text-red-400 font-medium -mt-2 px-1">
              You've hit the {MAX_CHARS}-character limit — anything past this point wasn't added.
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || charCount === 0 || isBlocked}
            className={`relative w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 overflow-hidden ${
              isBlocked
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98] disabled:opacity-50'
            } ${isEmpty && !isPending && !isBlocked ? 'animate-vibrate-cta' : ''}`}
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

      <style jsx>{`
        @keyframes vibrate-cta {
          0%, 40%, 100% { transform: translateX(0) rotate(0deg); }
          2% { transform: translateX(-2px) rotate(-1deg); }
          4% { transform: translateX(2px) rotate(1deg); }
          6% { transform: translateX(-2px) rotate(-1deg); }
          8% { transform: translateX(2px) rotate(1deg); }
          10% { transform: translateX(-2px) rotate(0deg); }
          12% { transform: translateX(2px) rotate(0deg); }
          14% { transform: translateX(-1px) rotate(-1deg); }
          16% { transform: translateX(1px) rotate(1deg); }
          18% { transform: translateX(-1px) rotate(0deg); }
          20% { transform: translateX(1px) rotate(0deg); }
          22% { transform: translateX(-2px) rotate(-1deg); }
          24% { transform: translateX(2px) rotate(1deg); }
          26% { transform: translateX(-1px) rotate(0deg); }
          28% { transform: translateX(1px) rotate(0deg); }
          30% { transform: translateX(-1px) rotate(-1deg); }
          32% { transform: translateX(1px) rotate(1deg); }
          34% { transform: translateX(-1px) rotate(0deg); }
          36% { transform: translateX(1px) rotate(0deg); }
          38% { transform: translateX(0) rotate(0deg); }
        }
        :global(.animate-vibrate-cta) {
          animation: vibrate-cta 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
