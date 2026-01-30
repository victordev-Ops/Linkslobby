"use client"

import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { Dices, Brain, Lock, MessageCircleQuestion, Flame, ChevronRight, Ghost, Instagram, Twitter, MessageSquare } from "lucide-react"
import { useRef } from "react"

const features = [
  {
    title: "anonymous msgs 👻",
    tagline: "get honest thoughts.",
    summary: "share your unique link on your story. friends tap to send you anonymous messages. no one knows who sent what. absolute tea. ☕️",
    icon: Ghost,
    color: "from-purple-500/20 to-indigo-500/20",
    href: "/signup"
  },
  {
    title: "truth or dare 🎲",
    tagline: "live multiplayer fun.",
    summary: "create a lobby and drop the link in the gc. your friends join live. spin the wheel, pick truth or dare, and watch the chaos unfold in real-time.",
    icon: Dices,
    color: "from-rose-500/20 to-pink-500/20",
    href: "/signup"
  },
  {
    title: "do you know me? 🧠",
    tagline: "test your besties.",
    summary: "make a 10-question quiz about yourself. send it to your squad. see who's a real one and who's fake. leaderboard reveals the winner.",
    icon: Brain,
    color: "from-blue-500/20 to-cyan-500/20",
    href: "/signup"
  },
  {
    title: "confessions 🔒",
    tagline: "secret notes.",
    summary: "create a safe space for confessions. people can vent or tell you secrets they've been hiding, completely anonymously.",
    icon: Lock,
    color: "from-violet-500/20 to-purple-500/20",
    href: "/signup"
  },
  {
    title: "hot seat 🔥",
    tagline: "rapid fire pressure.",
    summary: "you're in the hot seat. friends fire questions at you. you have 5 seconds to answer. hesitation = sus.",
    icon: Flame,
    color: "from-amber-500/20 to-red-500/20",
    href: "/signup"
  }
]

function FeatureCard({ feature, index }: { feature: typeof features[0], index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 100, damping: 20 }}
    >
      <Link href={feature.href} className="block group">
        <div className={`relative overflow-hidden bg-gradient-to-br ${feature.color} backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] active:scale-[0.98]`}>

          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:rotate-6 transition-transform duration-300 shadow-inner">
                <feature.icon size={32} />
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/30 group-hover:bg-white group-hover:text-black transition-all">
                <ChevronRight size={20} />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black text-white leading-tight mb-1 lowercase tracking-tight">{feature.title}</h3>
              <p className="text-white/60 text-sm font-bold uppercase tracking-wider mb-4">{feature.tagline}</p>

              <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                <p className="text-white/80 text-sm font-medium leading-relaxed">
                  {feature.summary}
                </p>
              </div>
            </div>
          </div>

        </div>
      </Link>
    </motion.div>
  )
}

function Footer() {
  return (
    <footer className="mt-20 py-12 px-6 border-t border-white/5 bg-black/20 backdrop-blur-sm relative z-20">
      <div className="flex flex-col items-center text-center space-y-8">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-xl italic">S</span>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-black text-white tracking-tight">say.</h3>
          <p className="text-white/50 text-sm max-w-xs mx-auto">
            the safe space for honest convos with your squad.
          </p>
        </div>

        <div className="flex items-center gap-6 text-white/50">
          <Link href="#" className="hover:text-white transition-colors"><Instagram size={20} /></Link>
          <Link href="#" className="hover:text-white transition-colors"><Twitter size={20} /></Link>
          <Link href="#" className="hover:text-white transition-colors"><MessageSquare size={20} /></Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs font-bold text-white/30 uppercase tracking-widest">
          <Link href="#" className="hover:text-white/60 transition">Terms</Link>
          <Link href="#" className="hover:text-white/60 transition">Privacy</Link>
          <Link href="#" className="hover:text-white/60 transition">Guidelines</Link>
        </div>

        <div className="text-[10px] font-medium text-white/20">
          © 2026 Say App. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  const containerRef = useRef(null)

  return (
    <div ref={containerRef} className="min-h-screen relative bg-[#0f0a1e] text-white selection:bg-purple-500/30 overflow-x-hidden font-sans">

      {/* Reduced Gradient Background - Focused Purple Ascent */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] bg-purple-900/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-[40%] right-[-10%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[70vw] h-[70vw] bg-violet-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto min-h-screen flex flex-col">

        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f0a1e]/80 backdrop-blur-xl border-b border-white/5 mx-auto">
          <div className="max-w-lg mx-auto p-4 flex items-center justify-between">
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
          </div>
        </nav>

        {/* Hero Section */}
        <div className="px-6 pt-28 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2 mb-12"
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
            className="mb-16 perspective-1000 relative z-20"
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
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2 opacity-60">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white">game_collection_v2.0</span>
              <span className="text-[10px] font-bold">✨</span>
            </div>

            <div className="space-y-6">
              {features.map((feature, idx) => (
                <FeatureCard key={idx} feature={feature} index={idx} />
              ))}
            </div>
          </div>
        </div>

        <Footer />

        {/* Floating CTA */}
        <div className="fixed bottom-6 left-6 right-6 z-40">
          <Link
            href="/signup"
            className="block w-full max-w-lg mx-auto bg-white text-black text-center font-black text-lg py-4 rounded-[2rem] shadow-xl shadow-purple-900/20 active:scale-95 transition-transform border border-white/50 hover:bg-slate-50"
          >
            Get Started 🚀
          </Link>
        </div>

      </div>
    </div>
  )
}
