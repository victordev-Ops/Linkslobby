"use client"

import LogoutButton from "@/components/LogoutButton"
import Link from "next/link"
import { User, Mail, ArrowLeft, LogIn, Bell, Moon, Home } from "lucide-react"
import PushToggle from "@/components/PushToggle"
import { ThemeToggle } from "@/components/ThemeToggle"

interface SettingsClientProps {
  initialUser: any
  initialUsername: string
  initialPushEnabled: boolean
}

export default function SettingsClient({
  initialUser,
  initialUsername,
  initialPushEnabled,
}: SettingsClientProps) {
  const user = initialUser
  const username = initialUsername

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] transition-colors duration-300">

      {/* Background Ambience (Dark Mode only) */}
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Header - Fixed/Sticky and ensured to be on top */}
      <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-xl border-b dark:border-white/10 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-90 group"
          >
            <div className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </div>
            <span className="hidden sm:inline font-bold text-sm">Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold dark:text-white tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Settings Column */}
          <div className="md:col-span-2 space-y-6">

            {/* Profile Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/10 p-8 transition-all hover:shadow-md">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-[#1a1429]">
                    <span className="text-3xl font-black italic">
                      {user && username ? username.charAt(0).toUpperCase() : "?"}
                    </span>
                  </div>
                  {user && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-[#1a1429] flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {user ? `@${username}` : "Guest Explorer"}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    {user ? user.email : "Log in to save your settings"}
                  </p>
                  {!user && (
                    <Link href="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 transition">
                      Join now <LogIn size={16} />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Appearance Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-8 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Moon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Appearance</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">Customization</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                <div>
                  <p className="font-bold dark:text-white text-sm">Theme Mode</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Choose between light, dark, or system preference</p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            {/* Notifications Card */}
            {user && (
              <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-8 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Stay Updated</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">Notifications</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <PushToggle userId={user.id} initialPushEnabled={initialPushEnabled} />
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-500/5 rounded-xl border border-blue-100/50 dark:border-blue-500/10">
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                      Receive instant alerts on your device whenever someone sends you an anonymous confession.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Account Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-8 transition-all">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-white">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Account</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">Security & Auth</p>
                </div>
              </div>

              <div className="space-y-6">
                {user ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1">Email Address</p>
                        <p className="font-bold text-gray-900 dark:text-white truncate">{user.email}</p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1">Public Handle</p>
                        <p className="font-bold text-gray-900 dark:text-white">@{username}</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t dark:border-white/10">
                      <LogoutButton />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                      Sync your data and access personalized features by logging in.
                    </p>
                    <Link href="/login" className="block">
                      <button className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs rounded-2xl active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-3">
                        <LogIn size={18} />
                        Get Started
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/10 p-6 sticky top-28 transition-all">
              <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">Quick Navigation</h3>
              <div className="space-y-2">
                {[
                  { name: 'Dashboard', href: '/dashboard', label: 'Home' },
                  { name: 'Inbox', href: '/inbox', label: 'Confessions' },
                  { name: 'Profile', href: '/profile', label: 'View Public' },
                ].map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
                  >
                    <span className="font-bold text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">{link.name}</span>
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{link.label}</span>
                  </Link>
                ))}
                <div className="mt-4 pt-4 border-t dark:border-white/5">
                  <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 italic">More settings coming soon...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-only back button - Redesigned to be less intrusive */}
        <div className="fixed bottom-24 left-6 right-6 sm:hidden z-20 pointer-events-none">
          <Link
            href="/dashboard"
            className="pointer-events-auto float-right w-14 h-14 bg-white dark:bg-[#1a1429] shadow-2xl rounded-2xl flex items-center justify-center text-gray-900 dark:text-white border border-gray-100 dark:border-white/10 active:scale-95 transition-all"
          >
            <Home className="h-6 w-6" />
          </Link>
        </div>
      </div>
    </div>
  )
}


