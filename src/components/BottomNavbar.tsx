//src/components/BottomNavbar.tsx
'use client'

import { Home, Inbox, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useNotifications } from '@/context/NotificationContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useTransition } from 'react'

export default function BottomNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { unreadCount } = useNotifications()
  const [isPending, startTransition] = useTransition()
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Inbox', href: '/inbox', icon: Inbox, badge: unreadCount },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    setPendingPath(href)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto px-6 h-16 flex justify-between items-center">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/inbox' && pathname.startsWith('/inbox'))
          const isPendingThis = pendingPath === item.href
          const shouldHighlight = isActive || isPendingThis

          return (
            <Link 
              key={item.name} 
              href={item.href}
              onClick={(e) => handleNavClick(item.href, e)}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-colors ${
                shouldHighlight ? 'text-purple-600' : 'text-gray-400 hover:text-purple-400'
              }`}
            >
              <div className="relative p-1">
                <item.icon size={24} strokeWidth={shouldHighlight ? 2.5 : 2} />
                
                <AnimatePresence>
                  {item.badge !== undefined && item.badge > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span className="text-[10px] font-medium mt-0.5">{item.name}</span>
              
              {shouldHighlight && (
                <motion.div 
                  layoutId="nav-indicator"
                  className="absolute -bottom-1 w-1 h-1 bg-purple-600 rounded-full"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
            }
