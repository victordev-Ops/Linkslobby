'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AuthFormProps {
  children: ReactNode
}

export default function AuthForm({ children }: AuthFormProps) {
  return (
    <motion.div
      // Entry animation: fades in and slides up from 20px below
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        ease: [0.22, 1, 0.36, 1] // Custom cubic-bezier for a smooth "snap" feel
      }}
      className="w-full flex items-center justify-center"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-purple-900/5 border border-slate-100 p-8 md:p-10 relative overflow-hidden">
        {/* Subtle decorative purple gradient flare in the corner */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
        
        {/* The actual form content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </motion.div>
  )
}
