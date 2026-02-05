'use client'

import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function TODError({ reset }: { reset: () => void }) {
    return (
        <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center p-6">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Game Error</h2>
                <p className="text-gray-400 mb-6 text-sm">The game encountered an issue. Please try again.</p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 active:scale-95 transition-all"
                    >
                        <RefreshCw size={16} /> Retry
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
