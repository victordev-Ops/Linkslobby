//src/components/AuthForm.tsx
'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AuthFormProps {
  children: ReactNode
}

export default function AuthForm({ children }: AuthFormProps) {
  return (
    <div className="w-full flex items-center justify-center relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.5, 
          ease: [0.22, 1, 0.36, 1]
        }}
        className="w-full max-w-md"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-purple-900/10 border border-white/50 p-8 md:p-10 relative overflow-hidden">
          {/* Animated gradient orbs */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 pointer-events-none animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-gradient-to-tr from-purple-400 to-blue-400 rounded-full blur-3xl opacity-20 pointer-events-none animate-pulse delay-1000" />
          
          {/* Subtle top border accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-50" />
          
          {/* Content */}
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  )
            }
