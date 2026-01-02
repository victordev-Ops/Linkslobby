// app/confess/[slug]/ConfessionForm.tsx
'use client'

import { useState, useTransition, useRef } from 'react'

type ActionResponse = { error?: string; success?: boolean }

interface ConfessionFormProps {
  profileId: string
  action: (profileId: string, formData: FormData) => Promise<ActionResponse>
}

export default function ConfessionForm({ profileId, action }: ConfessionFormProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<ActionResponse | null>(null)
  const [charCount, setCharCount] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (formData: FormData) => {
    setFeedback(null) // Reset errors

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

  // If success, show success view with a "Send Another" button
  if (feedback?.success) {
    return (
      <div className="text-center animate-fade-in-up">
        <div className="mb-4 text-5xl">✨</div>
        <h3 className="text-xl font-medium text-white mb-2">Sent Successfully!</h3>
        <p className="text-neutral-400 mb-8">Your secret is safe with us.</p>
        
        <button
          onClick={() => setFeedback(null)}
          className="w-full py-3 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-200 text-sm font-medium"
        >
          Send Another
        </button>
      </div>
    )
  }

  return (
    <form 
      ref={formRef} 
      action={handleSubmit} 
      className="space-y-4"
    >
      {/* Error Message */}
      {feedback?.error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
          {feedback.error}
        </div>
      )}

      {/* Text Area Container */}
      <div className="relative group">
        <textarea
          name="message"
          rows={5}
          placeholder="Type your confession here..."
          className="w-full bg-neutral-900/50 text-neutral-200 placeholder-neutral-600 rounded-2xl p-4 border border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all resize-none text-base leading-relaxed"
          required
          minLength={1}
          maxLength={1000}
          disabled={isPending}
          onChange={(e) => setCharCount(e.target.value.length)}
        />
        
        {/* Character Count */}
        <div className="absolute bottom-3 right-4 text-xs font-mono transition-colors duration-200">
          <span className={charCount > 900 ? 'text-red-400' : 'text-neutral-600'}>
            {charCount}
          </span>
          <span className="text-neutral-700">/1000</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || charCount === 0}
        className="relative w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 overflow-hidden"
      >
        <span className={`flex items-center justify-center gap-2 ${isPending ? 'opacity-0' : 'opacity-100'}`}>
          Send anonymously
        </span>
        
        {/* Loading Spinner overlay */}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </button>

      <p className="text-center text-xs text-neutral-600 pt-2">
        IP addresses are never stored.
      </p>
    </form>
  )
          }
        
