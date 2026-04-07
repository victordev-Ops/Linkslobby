'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, Home, RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function TODError({ reset }: { reset: () => void }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isRetrying, setIsRetrying] = useState(false)

    const handleRetry = () => {
        setIsRetrying(true)
        // Refresh the router cache to re-fetch server data
        router.refresh()
        // Re-render the error boundary's children via startTransition
        startTransition(() => {
            reset()
        })
        // Fallback: if still stuck after 3s, do a hard reload
        setTimeout(() => {
            if (document.querySelector('[data-error-boundary]')) {
                window.location.reload()
            }
            setIsRetrying(false)
        }, 3000)
    }

    const retrying = isRetrying || isPending

    return (
        <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center p-6" data-error-boundary>
            <div className="text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Game Error</h2>
                <p className="text-gray-400 mb-6 text-sm">The game encountered an issue. Please try again.</p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {retrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {retrying ? 'Retrying...' : 'Retry'}
                    </button>
                    <Link
                        href="/tod"
                        className="bg-white/10 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-white/20 active:scale-95 transition-all"
                    >
                        <Home size={16} /> Lobbies
                    </Link>
                </div>
            </div>
        </div>
    )
}
