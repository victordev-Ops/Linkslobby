"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { MessageCircle, ArrowRight, Instagram, Ghost } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#5D00B3] via-[#85006C] to-[#C90076] text-white">
      {/* Background blobs for depth */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-500 rounded-full mix-blend-overlay filter blur-[128px] opacity-40 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-fuchsia-500 rounded-full mix-blend-overlay filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 container mx-auto px-4 h-full flex flex-col items-center justify-center min-h-[100dvh]">

        {/* Helper Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute top-6 left-6"
        >
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-xl">
            <span className="text-xl font-black italic">S</span>
          </div>
        </motion.div>

        {/* Hero Content */}
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-10">

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="space-y-4"
          >
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter drop-shadow-sm">
              say.
              <span className="text-4xl align-top ml-2">🤫</span>
            </h1>
            <p className="text-xl md:text-2xl font-bold text-white/90 max-w-lg mx-auto leading-relaxed">
              get anonymous messages on instagram!
            </p>
          </motion.div>

          {/* 3D Tilted Card Preview */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 10 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
            className="perspective-1000"
          >
            <div className="relative w-80 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-[2.5rem] shadow-2xl transform rotate-[-6deg] hover:rotate-0 transition-transform duration-500">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />
              <div className="mt-6 space-y-4">
                <div className="h-14 bg-gradient-to-r from-orange-400 to-rose-400 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm flex items-center gap-1">
                    <Instagram size={16} /> story sticker
                  </span>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm text-slate-800 font-bold text-center text-lg leading-tight">
                  send me anonymous messages! <br />
                  <span className="text-sm font-normal text-slate-400 mt-1 block">ashley asked</span>
                </div>
                <div className="h-10 bg-black/20 rounded-xl w-3/4 mx-auto animate-pulse" />
              </div>
            </div>
          </motion.div>

          {/* Steps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex items-center gap-2 text-sm md:text-base font-bold text-white/80 bg-black/20 px-6 py-3 rounded-full backdrop-blur-sm border border-white/10"
          >
            <span>1. Copy Link</span>
            <ArrowRight size={14} className="opacity-50" />
            <span>2. Share</span>
            <ArrowRight size={14} className="opacity-50" />
            <span>3. Get Answers</span>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="w-full max-w-xs flex flex-col gap-3"
          >
            <Link
              href="/signup"
              className="group relative w-full bg-white text-[#85006C] font-black text-lg py-4 rounded-2xl shadow-xl shadow-purple-900/40 overflow-hidden transform transition active:scale-95 hover:shadow-2xl hover:shadow-purple-900/60"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-100/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
              <span className="relative flex items-center justify-center gap-2">
                Get Started <Ghost size={20} />
              </span>
            </Link>

            <Link
              href="/login"
              className="w-full bg-black/20 hover:bg-black/30 text-white font-bold text-base py-3.5 rounded-2xl transition backdrop-blur-sm border border-white/10 flex items-center justify-center"
            >
              Log In
            </Link>
          </motion.div>

        </div>

        {/* Footer */}
        <div className="absolute bottom-6 text-white/40 text-[10px] font-medium tracking-wide">
          © {new Date().getFullYear()} Say App. Not affiliated with Instagram.
        </div>
      </div>
    </div>
  )
}
