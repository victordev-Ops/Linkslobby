// app/page.tsx
import Link from "next/link"

// This is your Landing Page (Homepage)
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-lg">
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">
          say.
        </h1>
        <p className="text-xl text-slate-600">
          Anonymous confessions and Q&A for your friends and followers.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link 
            href="/login" 
            className="px-8 py-4 bg-violet-600 text-white rounded-2xl font-bold text-lg hover:bg-violet-700 transition-all shadow-lg shadow-violet-200"
          >
            Get Started
          </Link>
          <Link 
            href="/login" 
            className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all"
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  )
}
