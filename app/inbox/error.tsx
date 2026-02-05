'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

export default function InboxError({ reset }: { reset: () => void }) {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0f0a1e] flex items-center justify-center p-6">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load inbox</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Something went wrong loading your messages.</p>
                <button
                    onClick={reset}
                    className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 mx-auto hover:bg-purple-700 active:scale-95 transition-all"
                >
                    <RefreshCw size={16} /> Try Again
                </button>
            </div>
        </div>
    )
}
