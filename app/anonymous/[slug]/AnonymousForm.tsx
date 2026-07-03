// app/anonymous/[slug]/AnonymousForm.tsx
'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Lock, Send, CheckCircle, Sparkles } from 'lucide-react'

type ActionResponse = { error?: string; success?: boolean }

interface AnonymousFormProps {
  profileId: string
  isBlocked?: boolean
  action: (profileId: string, formData: FormData) => Promise<ActionResponse>
}

const MAX_CHARS = 1000

// Counts by grapheme cluster (what a person perceives as "one character"),
// not by raw Unicode code point. This matters for compound emoji — flags,
// family emoji, skin-tone modifiers, anything joined with a ZWJ (👨‍👩‍👧‍👦, 👍🏽,
// 🏳️‍🌈) — which are made of multiple code points but read as a single
// character. Array.from(str) would count each piece separately and could
// slice a compound emoji in half when trimming to the limit. Using the same
// segmenter on the client and server keeps the counter, the truncation
// point, and the server's validation permanently in agreement.
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter('en', { granularity: 'grapheme' })
  : null

function toGraphemes(value: string): string[] {
  if (segmenter) {
    return Array.from(segmenter.segment(value), (s) => s.segment)
  }
  // Fallback for environments without Intl.Segmenter (very old browsers) —
  // still better than raw UTF-16 .length, though it can't group ZWJ sequences.
  return Array.from(value)
}

// Rotating hints shown as an animated, typewriter-style placeholder.
// Gives senders a nudge on the kind of messages that land well.
const SUGGESTIONS = [
  "You're giving main character energy lately 🎬",
  "Ok but why are you this funny 😭",
  "I've had a crush on you since forever 👀",
  "Real ones know you're the moment fr",
  "This is your sign to text them first 👉",
  "Your vibe is unmatched, ngl",
]

export default function AnonymousForm({ profileId, action, isBlocked = false }: AnonymousFormProps) {
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
  // Runs continuously until the sender starts typing their own message.
  useEffect(() => {
    if (!isEmpty) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>
    let msgIndex = 0

    const typeMessage = () => {
      const message = SUGGESTIONS[msgIndex % SUGGESTIONS.length]
      let charIndex = 0

      const typeChar = () => {
        if (cancelled) return
        if (charIndex <= message.length) {
          setPlaceholderText(message.slice(0, charIndex))
          charIndex++
          timeoutId = setTimeout(typeChar, 45)
        } else {
          timeoutId = setTimeout(eraseMessage, 1400)
        }
      }
      typeChar()
    }

    const eraseMessage = () => {
      const message = SUGGESTIONS[msgIndex % SUGGESTIONS.length]
      let charIndex = message.length

      const eraseChar = () => {
        if (cancelled) return
        if (charIndex >= 0) {
          setPlaceholderText(message.slice(0, charIndex))
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
      // Hard stop at the limit — trimming on grapheme boundaries means a
      // compound emoji at the cutoff is either kept whole or dropped whole,
      // never split into a broken glyph.
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
    // Catch whitespace-only messages before the round trip — required/
    // minLength on the textarea don't stop a string of only spaces or
    // newlines, so without this the server would be the first to reject it.
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
      <div className="text-center py-4">
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <CheckCircle size={52} className="text-indigo-600 animate-pop-in" strokeWidth={1.5} />
            <Sparkles size={18} className="absolute -top-1 -right-2 text-amber-400 animate-sparkle" />
            <Sparkles size={12} className="absolute -bottom-1 -left-3 text-indigo-400 animate-sparkle [animation-delay:0.3s]" />
          </div>
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-1">Delivered! 🎯</h3>
        <p className="text-gray-400 text-sm mb-8">No one will ever know it was you.</p>

        <div className="space-y-3">
          <button
            onClick={() => setFeedback(null)}
            className="w-full py-3 px-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl transition-all text-sm active:scale-95"
          >
            Send another one 🔥
          </button>

          <Link
            href="/signup"
            className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 text-left"
          >
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
              <Lock size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">Get your own anonymous inbox</p>
              <p className="text-indigo-200 text-xs mt-0.5">Let people spill their secrets to you</p>
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
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-500 text-sm text-center font-medium"
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
          aria-describedby={wasTruncated ? 'message-limit-notice' : undefined}
          className="w-full bg-gray-50 text-gray-900 placeholder-gray-400 rounded-2xl p-4 border border-gray-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none text-sm leading-relaxed"
          required
          minLength={1}
          disabled={isPending || isBlocked}
          onChange={handleChange}
        />
        <div className="absolute bottom-3 right-4 text-xs font-mono">
          <span className={isNearLimit ? 'text-red-400 font-bold' : 'text-gray-300'}>
            {charCount}
          </span>
          <span className="text-gray-200">/{MAX_CHARS}</span>
        </div>
      </div>

      {wasTruncated && (
        <p id="message-limit-notice" role="status" className="text-xs text-red-400 font-medium -mt-1 px-1">
          You've hit the {MAX_CHARS}-character limit — anything past this point wasn't added.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || charCount === 0 || isBlocked}
        className={`w-full py-4 rounded-2xl font-bold text-sm shadow-lg transition-all duration-200 flex items-center justify-center gap-2
          ${isBlocked
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-[0.98] disabled:opacity-50'
          }
          ${isEmpty && !isPending && !isBlocked ? 'animate-vibrate-cta' : ''}
        `}
      >
        {isPending ? (
          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send size={15} />
            {isBlocked ? "You're blocked here 🚫" : 'Send anonymously 🚀'}
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400 pt-1">
        Your identity stays hidden. IP is never stored.
      </p>

      <style jsx>{`
        /* Vibrate for 1s, rest for 1.5s, repeat — nudges the sender to hit send. */
        @keyframes vibrate-cta {
          0%,
          40%,
          100% {
            transform: translateX(0) rotate(0deg);
          }
          2% {
            transform: translateX(-2px) rotate(-1deg);
          }
          4% {
            transform: translateX(2px) rotate(1deg);
          }
          6% {
            transform: translateX(-2px) rotate(-1deg);
          }
          8% {
            transform: translateX(2px) rotate(1deg);
          }
          10% {
            transform: translateX(-2px) rotate(0deg);
          }
          12% {
            transform: translateX(2px) rotate(0deg);
          }
          14% {
            transform: translateX(-1px) rotate(-1deg);
          }
          16% {
            transform: translateX(1px) rotate(1deg);
          }
          18% {
            transform: translateX(-1px) rotate(0deg);
          }
          20% {
            transform: translateX(1px) rotate(0deg);
          }
          22% {
            transform: translateX(-2px) rotate(-1deg);
          }
          24% {
            transform: translateX(2px) rotate(1deg);
          }
          26% {
            transform: translateX(-1px) rotate(0deg);
          }
          28% {
            transform: translateX(1px) rotate(0deg);
          }
          30% {
            transform: translateX(-1px) rotate(-1deg);
          }
          32% {
            transform: translateX(1px) rotate(1deg);
          }
          34% {
            transform: translateX(-1px) rotate(0deg);
          }
          36% {
            transform: translateX(1px) rotate(0deg);
          }
          38% {
            transform: translateX(0) rotate(0deg);
          }
        }

        :global(.animate-vibrate-cta) {
          animation: vibrate-cta 2.5s ease-in-out infinite;
        }

        @keyframes pop-in {
          0% {
            transform: scale(0.4);
            opacity: 0;
          }
          60% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(1);
          }
        }

        :global(.animate-pop-in) {
          animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes sparkle {
          0%,
          100% {
            transform: scale(0.8) rotate(0deg);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.2) rotate(15deg);
            opacity: 1;
          }
        }

        :global(.animate-sparkle) {
          animation: sparkle 1.6s ease-in-out infinite;
        }
      `}</style>
    </form>
  )
}
