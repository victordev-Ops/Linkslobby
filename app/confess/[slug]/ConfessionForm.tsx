// app/confess/[slug]/ConfessionForm.tsx
'use client'

import { useState } from 'react'

type SendConfessionAction = (profileId: string, slug: string, formData: FormData) => Promise<void>

interface ConfessionFormProps {
  sendConfession: SendConfessionAction
  profileId: string
  slug: string
  status?: string
}

export default function ConfessionForm({
  sendConfession,
  profileId,
  slug,
  status,
}: ConfessionFormProps) {
  const [characterCount, setCharacterCount] = useState(0)

  return (
    <form action={sendConfession.bind(null, profileId, slug)} className="space-y-5">
      <textarea
        name="message"
        rows={6}
        placeholder="Send me anonymous messages..."
        className="w-full px-6 py-5 text-lg text-gray-800 placeholder-gray-500 bg-white border-4 border-gray-300 rounded-3xl focus:outline-none focus:border-purple-500 resize-none transition-all"
        required
        minLength={1}
        maxLength={1000}
        defaultValue={status === 'success' ? '' : undefined}
        onChange={(e) => setCharacterCount(e.target.value.length)}
      />

      <div className="flex justify-between items-center px-2">
        <p className="text-sm text-gray-600">100% anonymous</p>
        <p className={`text-sm font-bold ${characterCount > 900 ? 'text-red-600' : 'text-gray-600'}`}>
          {characterCount}/1000
        </p>
      </div>

      <button
        type="submit"
        disabled={characterCount === 0}
        className="w-full py-5 bg-black text-white font-bold text-xl rounded-full shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        Send!
      </button>
    </form>
  )
}
