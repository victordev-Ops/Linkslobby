'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Unhandled Application Error:', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0a1e] px-4">
            <div className="max-w-md w-full text-center space-y-8">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-[2rem] flex items-center justify-center text-rose-500 mb-6">
                        <AlertCircle size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Something went wrong</h1>
                    <p className="mt-4 text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                        An unexpected error occurred. We've been notified and are looking into it.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <button
                        onClick={() => reset()}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 dark:bg-purple-600 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 hover:bg-slate-800 dark:hover:bg-purple-700"
                    >
                        <RefreshCw size={18} />
                        Try Again
                    </button>
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm transition-all active:scale-95 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10"
                    >
                        <Home size={18} />
                        Go Home
                    </Link>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-300 dark:text-slate-600">
                        Error ID: {error.digest || 'unknown'}
                    </p>
                </div>
            </div>
        </div>
    )
}
