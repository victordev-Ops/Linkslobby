// app/confess/[slug]/ConfessionForm.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    <>
      <form action={sendConfession.bind(null, profileId, slug)} className="space-y-6">
        <div>
          <label htmlFor="message" className="block text-base font-medium text-gray-800 mb-3">
            Your confession
          </label>
          <textarea
            id="message"
            name="message"
            rows={7}
            placeholder="Say anything... ❤️"
            className="w-full px-5 py-4 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
            required
            minLength={1}
            maxLength={1000}
            defaultValue={status === 'success' ? '' : undefined}
            onChange={(e) => setCharacterCount(e.target.value.length)}
          />
          <div className="mt-3 flex justify-end">
            <p
              className={`text-sm font-medium transition-colors ${
                characterCount > 900
                  ? 'text-red-600'
                  : characterCount > 700
                  ? 'text-orange-600'
                  : 'text-gray-600'
              }`}
            >
              {characterCount}/1000
            </p>
          </div>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={characterCount === 0}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold text-lg rounded-xl hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md"
        >
          Send Anonymously
        </button>
      </form>

      {/* Get Your Own Link Button – with shaky animation */}
      <div className="mt-5 animate-shake-hover">
        <Link
          href="/sign-up"
          className="block w-full py-4 text-center text-purple-700 font-semibold text-lg border-2 border-purple-600 rounded-xl hover:bg-purple-50 transition-all duration-300"
        >
          Get Your Own Confession Link
        </Link>
      </div>
    </>
  )
}
