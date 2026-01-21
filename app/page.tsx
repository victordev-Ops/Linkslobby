"use client"

import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { MessageCircle, ArrowRight, Instagram, Ghost, Dices, Brain, Lock, MessageCircleQuestion, Flame, ChevronRight } from "lucide-react"
import { useRef } from "react"

const features = [
  {
    title: "Anonymous Messenger",
    desc: "Get honest messages from your friends on Instagram.",
    icon: Ghost,
    color: "from-purple-500 to-indigo-600",
    shadow: "shadow-purple-500/20",
    href: "/signup"
  },
  {
    title: "Truth or Dare",
    desc: "Play live multiplayer truth or dare with friends.",
    icon: Dices,
    color: "from-rose-500 to-pink-600",
    shadow: "shadow-rose-500/20",
    href: "/signup"
  },
  {
    title: "Do You Know Me?",
    desc: "Create a quiz and see who knows you best.",
    icon: Brain,
    color: "from-blue-500 to-cyan-600",
    shadow: "shadow-blue-500/20",
    href: "/signup"
  },
  {
    title: "Confessions",
    desc: "Receive secret confessions anonymously.",
    icon: Lock,
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/20",
    href: "/signup"
  },
  {
    title: "AMA Sticker",
    desc: "Ask Me Anything sticker for your Story.",
    icon: MessageCircleQuestion,
    color: "from-orange-500 to-amber-600",
    shadow: "shadow-orange-500/20",
    href: "/signup"
  },
  {
    title: "Hot Seat",
    desc: "Answer rapid-fire questions under pressure.",
    icon: Flame,
    color: "from-amber-500 to-red-600",
    shadow: "shadow-amber-500/20",
    href: "/signup"
  }
]

function FeatureCard({ feature, index }: { feature: typeof features[0], index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 50 }}
      className="relative group"
    >
      <Link href={feature.href} className="block">
        <div className={`relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] p-6 hover:bg-white/15 transition-all duration-300 transform active:scale-95 hover:scale-[1.02] ${feature.shadow} shadow-xl`}>
          <div className="flex items-start justify-between">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white shadow-lg mb-4`}>
              <feature.icon size={28} />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 group-hover:bg-white/20 group-hover:text-white transition-colors">
              <ChevronRight size={18} />
            </div>
          </div>

          <h3 className="text-xl font-black text-white mb-2 tracking-tight">{feature.title}</h3>
          <p className="text-white/70 text-sm font-medium leading-relaxed">{feature.desc}</p>
        </div>
      </Link>
    </motion.div>
  )
}

export default function LandingPage() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const y = useTransform(scrollYProgress, [0, 1], [0, -50])

  return (
    <div ref={containerRef} className="min-h-screen relative bg-gradient-to-br from-[#5D00B3] via-[#85006C] to-[#C90076] text-white selection:bg-white/30">

      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-500 rounded-full mix-blend-overlay filter blur-[128px] opacity-40 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-fuchsia-500 rounded-full mix-blend-overlay filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col">

        {/* Navbar */}
        <nav className="p-6 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-xl"
          >
            <span className="text-xl font-black italic">S</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Link href="/login" className="px-5 py-2 bg-black/20 hover:bg-black/30 backdrop-blur-sm border border-white/10 rounded-full text-sm font-bold transition">
              Log In
            </Link>
          </motion.div>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col px-6 pt-8 pb-12 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-center space-y-6 mb-12"
          >
            <h1 className="text-7xl font-black tracking-tighter drop-shadow-sm">
              say.
              <span className="text-4xl align-top ml-2">🤫</span>
            </h1>
            <p className="text-xl font-bold text-white/90 leading-relaxed max-w-[280px] mx-auto">
              The ultimate social game app for friends.
            </p>
          </motion.div>

          {/* Social Proof / 3D Card */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 10 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mb-16 perspective-1000 relative z-20"
          >
            <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-[2.5rem] shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />
              <div className="mt-4 space-y-4 text-center">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-400 to-rose-400 px-4 py-1.5 rounded-full shadow-lg">
                  <Instagram size={14} />
                  <span className="text-xs font-bold">story sticker</span>
                </div>
                <h3 className="text-2xl font-black leading-tight">send me anonymous<br />messages!</h3>
                <div className="h-2 bg-white/20 rounded-full w-12 mx-auto" />
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <div className="space-y-4 pb-24">
            <div className="flex items-center gap-2 mb-4 opacity-80 pl-2">
              <Dices size={16} />
              <span className="text-xs font-black tracking-widest uppercase">Game Collection</span>
            </div>

            {features.map((feature, idx) => (
              <FeatureCard key={idx} feature={feature} index={idx} />
            ))}
          </div>
        </div>

        {/* Floating CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#C90076] via-[#C90076] to-transparent z-40">
          <Link
            href="/signup"
            className="block w-full max-w-md mx-auto bg-white text-[#C90076] text-center font-black text-lg py-4 rounded-2xl shadow-xl shadow-purple-900/20 active:scale-95 transition-transform"
          >
            Get Started
          </Link>
        </div>

      </div>
    </div>
  )
}
