'use client'

import { Home, MessageSquare, Bell, User, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNotifications } from '@/context/NotificationContext'
import { useState, useEffect } from 'react'

export default function BottomNavbar() {
  const pathname = usePathname()
  const { unreadCount, unreadMessagesCount, friendRequestCount } = useNotifications()
  const [mounted, setMounted] = useState(false)
  const [pendingPathname, setPendingPathname] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync pendingPathname with actual pathname
  useEffect(() => {
    setPendingPathname(null)
  }, [pathname])

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Messages', href: '/inbox', icon: MessageSquare, badge: unreadMessagesCount },
    { name: 'Notifications', href: '/notifications', icon: Bell, badge: unreadCount },
    { name: 'Profile', href: '/profile', icon: User, badge: friendRequestCount },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <nav className="fixed-bottom-nav fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0f0a1e]/90 backdrop-blur-lg border-t border-gray-100 dark:border-white/10 z-50 pb-[env(safe-area-inset-bottom)] transition-colors">
      <div className="max-w-md mx-auto px-4 h-16 flex justify-around items-center">
        {navItems.map((item) => {
          // Logic: Active if strictly matched or if it's the inbox subpath
          // Optimistically use pendingPathname if it exists
          const currentPath = pendingPathname || pathname
          const isActive = currentPath === item.href || (item.href === '/inbox' && currentPath.startsWith('/inbox'))

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                if (pathname !== item.href) {
                  setPendingPathname(item.href)
                }
              }}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors active:scale-95 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-white/30 hover:text-purple-400'
                }`}
            >
              <div className="relative p-1">
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />

                <span
                  suppressHydrationWarning
                  className={`absolute -top-1 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#1a1429] transition-all duration-300 origin-center ${mounted && item.badge && item.badge > 0
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-0'
                    }`}
                >
                  {mounted && item.badge !== undefined && item.badge > 0 ? (item.badge > 99 ? '99+' : item.badge) : ''}
                </span>
              </div>

              {/* Label */}
              <span className={`text-[9px] font-medium mt-0.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.name}
              </span>

              <div
                className={`absolute -top-0.5 w-8 h-1 bg-purple-600 dark:bg-purple-400 rounded-b-full transition-all duration-300 ease-out ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                  }`}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
    }
