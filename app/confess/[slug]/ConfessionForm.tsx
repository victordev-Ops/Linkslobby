// app/confess/[slug]/ConfessionForm.tsx
'use client'

import { useState } from 'react'

type SendConfessionAction = (profileId: string, slug: string, formData: FormData) => Promise<void>

interface ConfessionFormProps {
  sendConfession: SendConfessionAction
  profileId: string
  slug: string
  status?: string
  username: string
}

export default function ConfessionForm({
  sendConfession,
  profileId,
  slug,
  status,
}: ConfessionFormProps) {
  const [characterCount, setCharacterCount] = useState(0)

  return (
    <form action={sendConfession.bind(null, profileId, slug)} className="space-y-8">
      <div>
        <label htmlFor="message" className="block text-lg font-semibold text-purple-900 mb-4">
          Your confession (100% anonymous)
        </label>
        <textarea
          id="message"
          name="message"
          rows={8}
          placeholder="Say anything... they'll never know it's you ❤️"
          className="w-full px-6 py-5 border-2 border-purple-300 rounded-3xl focus:ring-4 focus:ring-purple-400 focus:border-purple-600 resize-none transition-all duration-300 shadow-inner text-gray-900 placeholder-gray-500"
          required
          minLength={1}
          maxLength={1000}
          defaultValue={status === 'success' ? '' : undefined}
          onChange={(e) => setCharacterCount(e.target.value.length)}
        />
        <div className="mt-3 flex justify-between items-center">
          <p className="text-sm text-purple-600 font-medium">Max 1000 characters</p>
          <p
            className={`text-sm font-bold transition-colors ${
              characterCount > 900
                ? 'text-red-600'
                : characterCount > 700
                ? 'text-orange-600'
                : 'text-purple-600'
            }`}
          >
            {characterCount}/1000
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={characterCount === 0}
        className="relative w-full py-6 overflow-hidden bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-xl rounded-3xl hover:from-purple-700 hover:to-violet-700 transform hover:scale-105 hover:shadow-2xl transition-all duration-500 group disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        <span className="relative z-10">Send Anonymously</span>
        <span className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full"></span>
      </button>
    </form>
  )
}
