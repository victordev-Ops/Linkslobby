'use client'

import { Home, Inbox, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useNotifications } from '@/context/NotificationContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useTransition, useEffect } from 'react'

export default function BottomNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { unreadCount } = useNotifications()
  const [isPending, startTransition] = useTransition()
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  // FIX: Reset pending path when the route actually changes
  useEffect(() => {
    setPendingPath(null)
  }, [pathname])

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Inbox', href: '/inbox', icon: Inbox, badge: unreadCount },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    
    // Don't trigger navigation if we are already there
    if (pathname === href) return

    setPendingPath(href)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto px-6 h-16 flex justify-around items-center">
        {navItems.map((item) => {
          // Logic: Active if strictly matched OR if it's the pending target
          const isActivePath = pathname === item.href || (item.href === '/inbox' && pathname.startsWith('/inbox'))
          const isPendingThis = pendingPath === item.href
          
          // Visual: Highlight if it's the current path (and not navigating away) OR if it's the target
          const shouldHighlight = (isActivePath && !pendingPath) || isPendingThis

          return (
            <Link 
              key={item.name} 
              href={item.href}
              onClick={(e) => handleNavClick(item.href, e)}
              className={`relative flex flex-col items-center justify-center w-16 h-full transition-colors ${
                shouldHighlight ? 'text-purple-600' : 'text-gray-400 hover:text-purple-400'
              }`}
            >
              <div className="relative p-1">
                <item.icon size={26} strokeWidth={shouldHighlight ? 2.5 : 2} />
                
                <AnimatePresence>
                  {item.badge !== undefined && item.badge > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Optional: Label (Can hide on mobile for cleaner look, but keeping it per your design) */}
              <span className={`text-[10px] font-medium mt-0.5 transition-opacity ${shouldHighlight ? 'opacity-100' : 'opacity-70'}`}>
                {item.name}
              </span>
              
              {shouldHighlight && (
                <motion.div 
                  layoutId="nav-indicator"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  className="absolute -top-0.5 w-8 h-1 bg-purple-600 rounded-b-full"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
