'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AuthFormProps {
  children: ReactNode
}

export default function AuthForm({ children }: AuthFormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex items-center justify-center px-4"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        {children}
      </div>
    </motion.div>
  )
}
