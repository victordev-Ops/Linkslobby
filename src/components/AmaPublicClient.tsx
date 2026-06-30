'use client'

import { useState } from 'react'
import { Send, Loader2, MessageCircleQuestion } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { sendAmaQuestion } from '@/actions/confessions'
import VerifiedBadge from '@/components/VerifiedBadge'
import { CheckCircle } from 'lucide-react'

const MAX_CHARS = 100

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
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim() || message.length > MAX_CHARS) return

    setIsSending(true)
    try {
      await sendAmaQuestion(profileId, message.trim())
      setSent(true)
    } catch (err) {
      console.error(err)
      alert("Failed to send question. Try again!")
    } finally {
      setIsSending(false)
    }
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
              {isPro && <VerifiedBadge size={18} className="text-orange-500" />}
            </div>
            <p className="text-sm text-gray-400 mb-6 font-medium">Anonymous Question</p>

            <div className="w-full relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask me anything..."
                maxLength={MAX_CHARS}
                className="w-full h-32 p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-orange-400 transition-colors resize-none text-gray-800 font-medium"
              />
              <div className={`absolute bottom-4 right-5 text-[10px] font-bold ${message.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-300'}`}>
                {message.length} / {MAX_CHARS}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSending || !message.trim() || isBlocked}
              className={`w-full mt-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all ${isBlocked
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-black text-white disabled:opacity-50'
                }`}
            >
              {isSending ? <Loader2 className="animate-spin" size={20} /> : isBlocked ? null : <Send size={18} />}
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
              <CheckCircle size={52} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Sent!</h2>
            <p className="text-gray-500 font-medium mb-8">
              Your anonymous question is waiting for {username}
            </p>
            <div className="w-full space-y-3">
              <button
                onClick={() => { setSent(false); setMessage(''); }}
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
    </motion.div>
  )
      }
