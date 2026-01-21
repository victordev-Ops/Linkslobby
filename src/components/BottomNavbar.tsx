'use client'

import { Home, MessageSquare, Bell, User, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNotifications } from '@/context/NotificationContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function BottomNavbar() {
  const pathname = usePathname()
  const { unreadCount } = useNotifications()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Messages', href: '/inbox', icon: MessageSquare, badge: 0 }, // Confessions are now in Notifications too, but kept for legacy
    { name: 'Notifications', href: '/notifications', icon: Bell, badge: unreadCount },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0f0a1e]/90 backdrop-blur-lg border-t border-gray-100 dark:border-white/10 z-50 pb-[env(safe-area-inset-bottom)] transition-colors">
      <div className="max-w-md mx-auto px-4 h-16 flex justify-around items-center">
        {navItems.map((item) => {
          // Logic: Active if strictly matched or if it's the inbox subpath
          const isActive = pathname === item.href || (item.href === '/inbox' && pathname.startsWith('/inbox'))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors active:scale-95 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-white/30 hover:text-purple-400'
                }`}
            >
              <div className="relative p-1">
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />

                {mounted && item.badge !== undefined && item.badge > 0 && (
                  <span
                    suppressHydrationWarning
                    className="absolute -top-1 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#1a1429]"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[9px] font-medium mt-0.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.name}
              </span>

              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  className="absolute -top-0.5 w-8 h-1 bg-purple-600 dark:bg-purple-400 rounded-b-full"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
