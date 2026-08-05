// app/three-word/[slug]/ThreeWordForm.tsx
'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Type, CheckCircle, Sparkles, User } from 'lucide-react'
import VerifiedBadge from '@/components/VerifiedBadge'
import { countWords } from '@/lib/three-word'

type ActionResponse = { error?: string; success?: boolean }

interface ThreeWordFormProps {
  slug: string
  username: string
  avatarUrl?: string | null
  isPro?: boolean
  isBlocked?: boolean
  isClosed?: boolean
  action: (slug: string, words: string) => Promise<ActionResponse>
}

// Rotating example answers shown as an animated, typewriter-style
// placeholder — same pattern as the confession form's SUGGESTIONS.
const SUGGESTIONS = [
  'Funny Kind Loyal',
  'Smart and Caring',
  'Calm Very Intelligent',
  'Bold Warm Hilarious',
  'Honest Creative Driven',
]

export default function ThreeWordForm({
  slug,
  username,
  avatarUrl,
  isPro = false,
  action,
  isBlocked = false,
  isClosed = false,
}: ThreeWordFormProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<ActionResponse | null>(null)
  const [value, setValue] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [placeholderText, setPlaceholderText] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const isEmpty = wordCount === 0
  const isValidCount = wordCount === 3
  const disabled = isPending || isBlocked || isClosed

  // Typewriter loop identical in behavior to ConfessionForm's, just cycling
  // through valid 3-word examples instead of confession openers.
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setValue(val)
    setWordCount(countWords(val))
  }

  const handleSubmit = (formData: FormData) => {
    const words = (formData.get('words') as string) ?? ''
    if (countWords(words) !== 3) {
      setFeedback({ error: `Enter exactly 3 words — you have ${countWords(words)}.` })
      return
    }

    setFeedback(null)
    startTransition(async () => {
      const result = await action(slug, words)
      if (result.success) {
        setFeedback({ success: true })
        formRef.current?.reset()
        setValue('')
        setWordCount(0)
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
              <CheckCircle size={52} className="text-cyan-600 animate-pop-in" strokeWidth={1.5} />
              <Sparkles size={18} className="absolute -top-1 -right-2 text-amber-400 animate-sparkle" />
              <Sparkles size={12} className="absolute -bottom-1 -left-3 text-cyan-400 animate-sparkle [animation-delay:0.3s]" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Sent Successfully!</h3>
          <p className="text-slate-500 text-sm mb-8">{username} will see your 3 words.</p>

          <div className="space-y-3">
            <button
              onClick={() => setFeedback(null)}
              className="w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-sm font-medium"
            >
              Send Another
            </button>

            <Link
              href="/signup"
              className="flex items-center gap-3 p-4 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-100 transition-colors text-left"
            >
              <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center">
                <Type size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">Create your own link</p>
                <p className="text-cyan-500 text-xs mt-0.5">See how your friends describe you</p>
              </div>
              <span className="text-cyan-400 text-lg">✨</span>
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
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-100 text-cyan-600 mb-5 overflow-hidden">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={username} width={56} height={56} className="w-full h-full object-cover" />
          ) : (
            <User size={24} />
          )}
        </div>

        <h1 className="text-xl font-semibold text-slate-900">
          Describe
        </h1>

        <div className="mt-1 inline-flex items-center gap-1.5 justify-center">
          <span className="text-xl font-bold text-cyan-600">{username}</span>
          {isPro && <VerifiedBadge size={18} />}
        </div>

        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          in exactly 3 words. Your identity is hidden.
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

          {isClosed && !feedback?.error && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 text-sm text-center">
              This game isn't accepting responses right now.
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              name="words"
              value={value}
              placeholder={placeholderText}
              aria-describedby="three-word-count"
              className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl p-4 pr-16 border border-slate-200 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all text-sm leading-relaxed"
              required
              disabled={disabled}
              autoComplete="off"
              onChange={handleChange}
            />
            <div id="three-word-count" className="absolute top-1/2 -translate-y-1/2 right-4 text-xs font-mono">
              <span className={wordCount > 3 ? 'text-red-400' : isValidCount ? 'text-cyan-500' : 'text-slate-400'}>
                {wordCount}
              </span>
              <span className="text-slate-300">/3</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 -mt-2 px-1">
            Separate each word with a space — e.g. "Funny Kind Loyal"
          </p>

          <button
            type="submit"
            disabled={disabled || !isValidCount}
            className={`relative w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 overflow-hidden ${
              isBlocked || isClosed
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-cyan-600 text-white hover:bg-cyan-700 active:scale-[0.98] disabled:opacity-50'
            } ${isEmpty && !isPending && !disabled ? 'animate-vibrate-cta' : ''}`}
          >
            <span className={`flex items-center justify-center gap-2 ${isPending ? 'opacity-0' : 'opacity-100'}`}>
              {isBlocked ? 'You have been blocked' : isClosed ? 'Game closed' : 'Send anonymously'}
            </span>
            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </button>
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
