"use client"

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AuthFormProps {
  children: ReactNode
}

export default function AuthForm({ children }: AuthFormProps) {
  return (
    <div className="w-full flex items-center justify-center relative z-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="bg-[#1a1429] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle accent line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500 opacity-30" />

          <div className="relative z-10">
            {children}
          </div>
        </div>

        {/* Footer Brand */}
        <div className="text-center mt-8 opacity-20 hover:opacity-40 transition-opacity">
          <span className="text-xl font-black text-white italic tracking-tighter">say.</span>
        </div>
      </motion.div>
    </div>
  )
}
