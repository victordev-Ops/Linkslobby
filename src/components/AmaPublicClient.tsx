'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Send, CheckCircle, Sparkles, MessageCircleQuestion } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { sendAmaQuestion, type AmaActionResponse } from '@/actions/confessions'
import { toGraphemes } from '@/lib/graphemes'
import VerifiedBadge from '@/components/VerifiedBadge'

const MAX_CHARS = 100

// Rotating hints shown as an animated, typewriter-style placeholder —
// same pattern as the anonymous-message form, just question-flavored.
const SUGGESTIONS = [
  "What's something you've never told anyone?",
  "Craziest thing that happened to you this year?",
  "What's your honest first impression of me?",
  "Any embarrassing childhood stories? 👀",
  "What's a rule you secretly break?",
  "Ask me literally anything...",
]

export default function AmaPublicClient({
  profileId,
  username,
  isPro = false,
  isBlocked = false
}: {
  profileId: string
  username: string
  isPro?: boolean
  isBlocked?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<AmaActionResponse | null>(null)
  const [message, setMessage] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [wasTruncated, setWasTruncated] = useState(false)
  const [placeholderText, setPlaceholderText] = useState('')
  const [sent, setSent] = useState(false)

  const isEmpty = charCount === 0
  const isNearLimit = charCount > Math.round(MAX_CHARS * 0.9)

  // Typewriter loop: types a suggestion, holds, erases it, moves to the next.
  // Runs continuously until the sender starts typing their own question.
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

  const handleSubmit = () => {
    // Catch whitespace-only questions before the round trip.
    if (message.trim().length === 0) {
      setFeedback({ error: 'Write something before sending.' })
      return
    }

    setFeedback(null)
    startTransition(async () => {
      const result = await sendAmaQuestion(profileId, message.trim())
      if (result.success) {
        setSent(true)
      } else {
        setFeedback({ error: result.error || 'Failed to send your question. Try again.' })
      }
    })
  }

  const resetForm = () => {
    setSent(false)
    setMessage('')
    setCharCount(0)
    setWasTruncated(false)
    setFeedback(null)
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.div
            key="form"
            exit={{ opacity: 0, y: -20 }}
            className="p-8 flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📝</span>
            </div>

            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h1 className="text-xl font-black text-gray-800 text-center">
                Ask {username}
              </h1>
              {isPro && <VerifiedBadge size={18} />}
            </div>
            <p className="text-sm text-gray-400 mb-6 font-medium">Anonymous Question</p>

            {feedback?.error && (
              <div
                role="alert"
                aria-live="assertive"
                className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-500 text-sm text-center font-medium"
              >
                {feedback.error}
              </div>
            )}

            <div className="w-full relative">
              <textarea
                value={message}
                onChange={handleChange}
                placeholder={placeholderText}
                aria-describedby={wasTruncated ? 'ama-limit-notice' : undefined}
                disabled={isPending || isBlocked}
                className="w-full h-32 p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-orange-400 transition-colors resize-none text-gray-800 font-medium"
              />
              <div className={`absolute bottom-4 right-5 text-[10px] font-bold ${isNearLimit ? 'text-red-500' : 'text-gray-300'}`}>
                {charCount} / {MAX_CHARS}
              </div>
            </div>

            {wasTruncated && (
              <p id="ama-limit-notice" role="status" className="w-full text-xs text-red-400 font-medium mt-2 px-1 text-left">
                You've hit the {MAX_CHARS}-character limit — anything past this point wasn't added.
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={isPending || isEmpty || isBlocked}
              className={`w-full mt-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all
                ${isBlocked
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-black text-white disabled:opacity-50'
                }
                ${isEmpty && !isPending && !isBlocked ? 'animate-vibrate-cta' : ''}
              `}
            >
              {isPending ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : isBlocked ? null : (
                <Send size={18} />
              )}
              <span>{isBlocked ? 'You have been blocked' : 'Send Question'}</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-12 flex flex-col items-center text-center"
          >
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <CheckCircle size={52} className="text-orange-500 animate-pop-in" strokeWidth={1.5} />
                <Sparkles size={18} className="absolute -top-1 -right-2 text-amber-400 animate-sparkle" />
                <Sparkles size={12} className="absolute -bottom-1 -left-3 text-orange-400 animate-sparkle [animation-delay:0.3s]" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Sent!</h2>
            <p className="text-gray-500 font-medium mb-8">
              Your anonymous question is waiting for <b className="text-black-600 ">{username}</b>
            </p>
            <div className="w-full space-y-3">
              <button
                onClick={resetForm}
                className="w-full py-3 px-6 bg-orange-100 hover:bg-orange-200 text-orange-600 rounded-xl transition-all duration-200 text-sm font-bold"
              >
                Send Another
              </button>

              <div className="pt-2">
                <Link
                  href="/signup"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-100 hover:border-orange-200 transition-all group overflow-hidden relative text-left"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 group-hover:translate-x-[100%] transition-all duration-1000 origin-left -translate-x-full" />
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <MessageCircleQuestion size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-sm group-hover:text-orange-600 transition-colors">Create your own Link</h3>
                    <p className="text-gray-500 text-xs line-clamp-1 mt-0.5">Receive anonymous questions</p>
                  </div>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </motion.div>
  )
  }
