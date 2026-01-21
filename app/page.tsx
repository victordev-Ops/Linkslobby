"use client"

import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { Dices, Brain, Lock, MessageCircleQuestion, Flame, ChevronRight, Ghost, Instagram } from "lucide-react"
import { useRef } from "react"

const features = [
  {
    title: "anonymous msgs 👻",
    desc: "get honest thoughts from your friends. no cap.",
    icon: Ghost,
    color: "bg-white/10",
    href: "/signup"
  },
  {
    title: "truth or dare 🎲",
    desc: "play live w/ besties. spill tea or do the dare.",
    icon: Dices,
    color: "bg-white/10",
    href: "/signup"
  },
  {
    title: "do you know me? 🧠",
    desc: "create your quiz. see who's a real one.",
    icon: Brain,
    color: "bg-white/10",
    href: "/signup"
  },
  {
    title: "confessions 🔒",
    desc: "send/receive secret notes. total privacy.",
    icon: Lock,
    color: "bg-white/10",
    href: "/signup"
  },
  {
    title: "hot seat 🔥",
    desc: "rapid fire questions. can you handle the heat?",
    icon: Flame,
    color: "bg-white/10",
    href: "/signup"
  }
]

function FeatureCard({ feature, index }: { feature: typeof features[0], index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200, damping: 20 }}
    >
      <Link href={feature.href} className="block group">
        <div className="relative overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-5 active:scale-95 transition-all duration-200 hover:bg-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
              <feature.icon size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white leading-tight mb-0.5 lowercase tracking-tight">{feature.title}</h3>
              <p className="text-white/60 text-xs font-medium leading-snug truncate">{feature.desc}</p>
            </div>
            <div className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all">
              <ChevronRight size={20} />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function LandingPage() {
  const containerRef = useRef(null)

  return (
    <div ref={containerRef} className="min-h-screen relative bg-[#0f0a1e] text-white selection:bg-purple-500/30 overflow-x-hidden font-sans">

      {/* Reduced Gradient Background - Focused Purple Ascent */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] bg-purple-900/40 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-[40%] right-[-10%] w-[60vw] h-[60vw] bg-indigo-900/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[70vw] h-[70vw] bg-violet-900/30 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col pb-24">

        {/* Navbar */}
        <nav className="p-6 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-10 h-10 bg-white/5 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/10"
          >
            <span className="text-xl font-black italic tracking-tighter">s.</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link href="/login" className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold transition uppercase tracking-widest">
              Login
            </Link>
          </motion.div>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col px-6 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2 mb-10"
          >
            <h1 className="text-8xl font-black tracking-tighter leading-none bg-gradient-to-br from-white via-white to-white/50 bg-clip-text text-transparent drop-shadow-2xl">
              say.
            </h1>
            <p className="text-lg font-bold text-white/50 lowercase tracking-wide">
              the social app for <span className="text-purple-400">real ones</span> 👾
            </p>
          </motion.div>

          {/* Social Proof / 3D Card */}
          <motion.div
            initial={{ opacity: 0, rotateX: 20, y: 40 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            transition={{ type: "spring", bounce: 0.4 }}
            className="mb-12 perspective-1000 relative z-20"
          >
            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-purple-500/20 to-indigo-500/20 backdrop-blur-2xl border border-white/20 p-6 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(124,58,237,0.2)] transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500 flex flex-col items-center justify-center text-center group">

              {/* Simulated Sticker */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="bg-white text-black p-5 rounded-3xl shadow-2xl max-w-[240px] w-full transform rotate-2 group-hover:rotate-0 transition-all"
              >
                <div className="flex items-center gap-2 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <div className="w-6 h-6 bg-gradient-to-tr from-yellow-400 to-fuchsia-600 rounded-lg flex items-center justify-center text-white"><Instagram size={14} /></div>
                  ask me anything
                </div>
                <div className="text-xl font-black leading-tight tracking-tight mb-2">
                  send me anonymous messages! 👇
                </div>
              </motion.div>

              <div className="mt-8 text-xs font-bold text-white/40 uppercase tracking-[0.2em] animate-pulse">
                tap to start
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2 opacity-60">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white">features_v2.0</span>
              <span className="text-[10px] font-bold">✨</span>
            </div>

            <div className="space-y-3">
              {features.map((feature, idx) => (
                <FeatureCard key={idx} feature={feature} index={idx} />
              ))}
            </div>
          </div>
        </div>

        {/* Floating CTA */}
        <div className="fixed bottom-6 left-6 right-6 z-40">
          <Link
            href="/signup"
            className="block w-full bg-white text-black text-center font-black text-lg py-4 rounded-[2rem] shadow-xl shadow-purple-900/20 active:scale-95 transition-transform border border-white/50 hover:bg-slate-50"
          >
            Get Started 🚀
          </Link>
        </div>

      </div>
    </div>
  )
}
