"use client"

import { motion } from "framer-motion"
import { Space_Grotesk, Inter } from "next/font/google"
import Image from "next/image"
import Link from "next/link"
import { ReactNode } from "react"

// Same two-role type system as /dashboard and the landing page.
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

interface AuthFormProps {
  children: ReactNode
}

export default function AuthForm({ children }: AuthFormProps) {
  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] font-[family-name:var(--font-body)] flex items-center justify-center relative overflow-hidden selection:bg-purple-500/30`}
    >
      {/* ambient faint-purple wash, matching the landing page */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 dark:bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full flex flex-col items-center justify-center relative z-10 px-4">
        <Link href="/" className="mb-8">
          <Image
            src="/linkslobby-logo.png"
            alt="Linkslobby"
            width={1116}
            height={316}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white dark:bg-[#1a1429] border border-slate-100 dark:border-white/5 rounded-3xl p-8 shadow-xl relative overflow-hidden">
            {/* Subtle accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500 opacity-40" />

            <div className="relative z-10">{children}</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
