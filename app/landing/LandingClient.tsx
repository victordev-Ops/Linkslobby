"use client"

import { useEffect, useState } from "react"
import { Space_Grotesk, Inter } from "next/font/google"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Heart,
  EyeOff,
  Flame,
  Brain,
  MessageCircleQuestion,
  Mic,
  Users,
  Star,
  Lock,
  Unlock,
  Gift,
  ArrowRight,
  Sparkles,
} from "lucide-react"

// Same two-role type system as /dashboard: Space Grotesk for personality
// (headlines, wordmark), Inter for quiet, legible body copy.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
})
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
})

const ROTATING_WORDS = [
  "a confession",
  "a dare",
  "a whisper",
  "a hot take",
  "a question",
]

const GAMES = [
  {
    name: "Confessions",
    blurb: "Drop a link in your bio. Friends send secrets, no names attached.",
    icon: Heart,
    accent: "purple",
  },
  {
    name: "Anonymous Messages",
    blurb: "Get honest messages from people who don't want to sign them.",
    icon: EyeOff,
    accent: "indigo",
  },
  {
    name: "Truth or Dare",
    blurb: "Open a lobby, invite friends, play live — no app-switching.",
    icon: Flame,
    accent: "rose",
  },
  {
    name: "Do You Know Me?",
    blurb: "Quiz your friends on you. Find out who's actually paying attention.",
    icon: Brain,
    accent: "blue",
  },
  {
    name: "Ask Me Anything",
    blurb: "Anonymous questions land in your inbox. Answer the ones you dare.",
    icon: MessageCircleQuestion,
    accent: "orange",
  },
  {
    name: "Hot Seat",
    blurb: "Go live. Friends fire rapid questions. You answer on the clock.",
    icon: Mic,
    accent: "amber",
  },
] as const

const ACCENT_STYLES: Record<
  string,
  { bg: string; text: string; ring: string; glow: string }
> = {
  purple: {
    bg: "bg-purple-100 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    ring: "ring-purple-500/20",
    glow: "shadow-purple-200 dark:shadow-purple-900/20",
  },
  indigo: {
    bg: "bg-indigo-100 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/20",
    glow: "shadow-indigo-200 dark:shadow-indigo-900/20",
  },
  rose: {
    bg: "bg-rose-100 dark:bg-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/20",
    glow: "shadow-rose-200 dark:shadow-rose-900/20",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/20",
    glow: "shadow-blue-200 dark:shadow-blue-900/20",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/20",
    glow: "shadow-orange-200 dark:shadow-orange-900/20",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
    glow: "shadow-amber-200 dark:shadow-amber-900/20",
  },
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
    glow: "shadow-emerald-200 dark:shadow-emerald-900/20",
  },
}

function RotatingWord() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length)
    }, 1900)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="relative inline-flex h-[1.15em] overflow-hidden align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={ROTATING_WORDS[index]}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block text-purple-600 dark:text-purple-400"
        >
          {ROTATING_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// Three stacked "notification" cards that auto-cycle to demonstrate, live,
// what actually happens inside the app — a real confession arriving, a
// whisper landing, a star reward — without needing real screenshots.
const DEMO_CARDS = [
  {
    key: "confession",
    label: "New confession",
    detail: "Someone in your circle just sent one in \u{1F92B}",
    icon: Heart,
    accent: "purple",
  },
  {
    key: "whisper",
    label: "Anonymous message",
    detail: "You have 1 new whisper waiting",
    icon: EyeOff,
    accent: "indigo",
  },
  {
    key: "stars",
    label: "+15 stars earned",
    detail: "From your last Hot Seat session",
    icon: Star,
    accent: "amber",
  },
] as const

function DemoStack() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % DEMO_CARDS.length)
    }, 2600)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative w-full max-w-sm h-64 sm:h-72">
      {/* faint purple glow behind the phone-card stack */}
      <div className="absolute inset-0 bg-purple-400/20 dark:bg-purple-500/10 rounded-[2rem] blur-3xl" />
      <div className="relative h-full rounded-[2rem] border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#1a1429]/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-slate-200 dark:bg-white/10" />
        <div className="flex flex-col items-center justify-center h-full px-6 gap-3">
          <AnimatePresence mode="wait">
            {(() => {
              const card = DEMO_CARDS[index]
              const styles = ACCENT_STYLES[card.accent]
              const Icon = card.icon
              return (
                <motion.div
                  key={card.key}
                  initial={{ y: 24, opacity: 0, scale: 0.96 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -24, opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className={`w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-[#1f1832] shadow-lg ${styles.glow} p-4 flex items-start gap-3`}
                >
                  <div
                    className={`w-10 h-10 shrink-0 rounded-xl ${styles.bg} ${styles.text} flex items-center justify-center`}
                  >
                    <Icon size={18} strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
                      {card.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5 truncate">
                      {card.detail}
                    </p>
                  </div>
                </motion.div>
              )
            })()}
          </AnimatePresence>

          {/* progress dots */}
          <div className="flex gap-1.5 mt-1">
            {DEMO_CARDS.map((c, i) => (
              <span
                key={c.key}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === index
                    ? "w-5 bg-purple-500"
                    : "w-1.5 bg-slate-200 dark:bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GameCard({
  game,
  delay,
}: {
  game: (typeof GAMES)[number]
  delay: number
}) {
  const styles = ACCENT_STYLES[game.accent]
  const Icon = game.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group relative rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md shadow-sm hover:shadow-md transition-shadow duration-300 p-5"
    >
      <div
        className={`w-11 h-11 rounded-xl ${styles.bg} ${styles.text} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}
      >
        <Icon size={20} strokeWidth={2.25} />
      </div>
      <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)] mb-1">
        {game.name}
      </h3>
      <p className="text-sm text-slate-500 dark:text-white/60 leading-relaxed">
        {game.blurb}
      </p>
    </motion.div>
  )
}

function StarCounter() {
  const [value, setValue] = useState(0)
  const target = 240

  useEffect(() => {
    let raf: number
    const start = performance.now()
    const duration = 1400

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <span className="tabular-nums">
      {value.toLocaleString()}
      <span className="text-amber-500">★</span>
    </span>
  )
}

export default function LandingClient() {
  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] font-[family-name:var(--font-body)] overflow-x-hidden`}
    >
      {/* ambient faint-purple wash, matching /dashboard */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 dark:bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* NAV */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/linkslobby-logo.png"
            alt="Linkslobby"
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <span className="font-bold text-lg text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
            Linkslobby
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all active:scale-95 hover:scale-[1.02]"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-10 sm:pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 text-xs font-bold text-purple-600 dark:text-purple-400 mb-6">
            <Sparkles size={13} />
            Play. Confess. Connect.
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.05] font-[family-name:var(--font-display)]">
            Send your friend
            <br />
            <RotatingWord />
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-500 dark:text-white/60 max-w-md leading-relaxed">
            Confessions, Truth or Dare, Hot Seat, and more — real games with
            the friends you already have. Every round earns you stars.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all active:scale-95 hover:scale-[1.02]"
            >
              Get started — it's free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="#games"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              See how it works
            </Link>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <DemoStack />
        </div>
      </section>

      {/* GAMES */}
      <section id="games" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-[family-name:var(--font-display)]">
            Pick a game, drop a link, watch it fill up
          </h2>
          <p className="mt-3 text-slate-500 dark:text-white/60">
            Every game runs on a link or a live lobby — no downloads for your
            friends, no awkward setup.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.map((game, i) => (
            <GameCard key={game.name} game={game} delay={i * 0.06} />
          ))}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: GAMES.length * 0.06 }}
            className="rounded-2xl border border-dashed border-purple-200 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-500/5 p-5 flex flex-col justify-center items-start"
          >
            <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
              <Sparkles size={20} strokeWidth={2.25} />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)] mb-1">
              More every month
            </h3>
            <p className="text-sm text-slate-500 dark:text-white/60 leading-relaxed">
              Rock Paper Scissors, party rounds, and new drops — the lobby
              keeps growing.
            </p>
          </motion.div>
        </div>
      </section>

      {/* STAR ECONOMY */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="rounded-[2rem] border border-purple-100 dark:border-purple-500/20 bg-gradient-to-br from-purple-50 via-white to-purple-50/50 dark:from-purple-500/10 dark:via-transparent dark:to-purple-500/5 p-8 sm:p-12 grid md:grid-cols-2 gap-10 items-center overflow-hidden relative">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-[family-name:var(--font-display)]">
              Every game pays in stars
            </h2>
            <p className="mt-3 text-slate-500 dark:text-white/60 leading-relaxed max-w-md">
              Answer a Hot Seat question, win a round of Rock Paper Scissors,
              or just show up — stars stack up automatically.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-white/70">
                <Unlock size={14} className="text-purple-600 dark:text-purple-400" />
                Unlock badges
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-white/70">
                <Gift size={14} className="text-purple-600 dark:text-purple-400" />
                Buy features
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-white/70">
                <Lock size={14} className="text-purple-600 dark:text-purple-400" />
                Enter Pro rounds
              </div>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="text-6xl sm:text-7xl font-bold text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
              <StarCounter />
            </div>
          </div>
        </div>
      </section>

      {/* FRIENDSHIP */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div className="flex justify-center md:justify-start order-2 md:order-1">
          <div className="relative w-56 h-40">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 3 + i * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.3,
                }}
                className="absolute w-16 h-16 rounded-full ring-4 ring-white dark:ring-[#0f0a1e] shadow-lg flex items-center justify-center text-white font-bold font-[family-name:var(--font-display)]"
                style={{
                  left: `${i * 40}px`,
                  top: i % 2 === 0 ? "0px" : "48px",
                  background: [
                    "linear-gradient(135deg,#a855f7,#6366f1)",
                    "linear-gradient(135deg,#f43f5e,#a855f7)",
                    "linear-gradient(135deg,#f59e0b,#f43f5e)",
                    "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  ][i],
                  zIndex: 4 - i,
                }}
              >
                <Users size={20} />
              </motion.div>
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-[family-name:var(--font-display)]">
            Built on the friends you already have
          </h2>
          <p className="mt-3 text-slate-500 dark:text-white/60 leading-relaxed max-w-md">
            Add friends, invite them into a lobby, or just share your link.
            Linkslobby is a place to play with people you actually know —
            anonymously when you want to be, out loud when you don't.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight font-[family-name:var(--font-display)]">
          Your friends are already in the lobby.
        </h2>
        <p className="mt-3 text-slate-500 dark:text-white/60">
          Create your link, drop it in your bio, and see what comes in.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all active:scale-95 hover:scale-[1.02]"
        >
          Get started — it's free
          <ArrowRight size={16} />
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-100 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/linkslobby-logo.png"
              alt="Linkslobby"
              width={22}
              height={22}
              className="rounded-md"
            />
            <span className="font-bold text-sm text-slate-700 dark:text-white/80 font-[family-name:var(--font-display)]">
              Linkslobby
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs font-bold text-slate-500 dark:text-white/50">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/safety" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Safety
            </Link>
          </div>
          <p className="text-xs text-slate-400 dark:text-white/40">
            &copy; {new Date().getFullYear()} Linkslobby
          </p>
        </div>
      </footer>
    </div>
  )
}
