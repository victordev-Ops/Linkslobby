'use client'

import { useState } from 'react'
import { Send, Loader2, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendAmaQuestion } from '@/actions/confessions'

const MAX_CHARS = 100 // Limit for AMA questions

export default function AmaPublicClient({
  profileId,
  username,
  isBlocked = false
}: {
  profileId: string,
  username: string,
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
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📝</span>
            </div>

            <h1 className="text-xl font-black text-gray-800 text-center mb-1">
              Ask @{username}
            </h1>
            <p className="text-sm text-gray-400 mb-6 font-medium">Anonymous Question</p>

            <div className="w-full relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask me anything..."
                maxLength={MAX_CHARS}
                className="w-full h-32 p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-purple-400 transition-colors resize-none text-gray-800 font-medium"
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
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Sent!</h2>
            <p className="text-gray-500 font-medium mb-8">
              Your anonymous question is waiting for @{username}
            </p>
            <button
              onClick={() => { setSent(false); setMessage(''); }}
              className="text-purple-600 font-bold text-sm"
            >
              Send another?
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

