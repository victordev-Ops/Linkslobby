"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Smartphone, Share, PlusSquare, MoreVertical, Monitor, CheckCircle2 } from "lucide-react"

// ── Step row ──────────────────────────────────────────────────────────────
function Step({ number, icon, text }: { number: number; icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black shrink-0">
        {number}
      </div>
      <div className="flex-1 text-sm text-gray-700 dark:text-white/70 leading-relaxed flex items-center gap-2">
        {icon}
        <span>{text}</span>
      </div>
    </div>
  )
}

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener("beforeinstallprompt", handler)

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") setInstalled(true)
    setDeferredPrompt(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] transition-colors duration-300 pb-16">
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/10 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/settings"
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-white active:scale-90 transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-gray-900 dark:text-white text-base">Download app</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 relative z-10">
        <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white mx-auto mb-3">
            <Smartphone size={24} />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">Install as an app</p>
          <p className="text-xs text-gray-400 dark:text-white/35 mt-1 leading-relaxed">
            This is a Progressive Web App — install it for a full-screen, app-like experience with faster loading
            and notifications.
          </p>

          {installed ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold">
              <CheckCircle2 size={16} /> Already installed
            </div>
          ) : deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="mt-4 w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-all active:scale-95"
            >
              Install now
            </button>
          ) : (
            <p className="mt-4 text-[11px] text-gray-400 dark:text-white/25">
              Follow the steps below for your device
            </p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/30 mb-2 px-1">
            iPhone / iPad (Safari)
          </p>
          <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
            <Step number={1} icon={<Share size={15} className="text-blue-500 shrink-0" />} text="Tap the Share icon in Safari's toolbar" />
            <Step number={2} icon={<PlusSquare size={15} className="text-gray-500 shrink-0" />} text='Scroll down and tap "Add to Home Screen"' />
            <Step number={3} icon={<CheckCircle2 size={15} className="text-green-500 shrink-0" />} text='Tap "Add" to confirm' />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/30 mb-2 px-1">
            Android (Chrome)
          </p>
          <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
            <Step number={1} icon={<MoreVertical size={15} className="text-gray-500 shrink-0" />} text="Tap the menu icon (⋮) in the top right" />
            <Step number={2} icon={<PlusSquare size={15} className="text-gray-500 shrink-0" />} text='Tap "Install app" or "Add to Home screen"' />
            <Step number={3} icon={<CheckCircle2 size={15} className="text-green-500 shrink-0" />} text="Confirm the install prompt" />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/30 mb-2 px-1">
            Desktop (Chrome / Edge)
          </p>
          <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
            <Step number={1} icon={<Monitor size={15} className="text-gray-500 shrink-0" />} text="Look for the install icon in the address bar" />
            <Step number={2} icon={<CheckCircle2 size={15} className="text-green-500 shrink-0" />} text='Click it, then "Install"' />
          </div>
        </div>
      </div>
    </div>
  )
            }
        
