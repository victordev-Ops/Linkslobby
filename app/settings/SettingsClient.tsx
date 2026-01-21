"use client"

import LogoutButton from "@/components/LogoutButton"
import Link from "next/link"
import { User, Mail, ArrowLeft, LogIn, Bell, Moon } from "lucide-react"
import PushToggle from "@/components/PushToggle"
import { ThemeToggle } from "@/components/ThemeToggle"

interface SettingsClientProps {
  initialUser: any
  initialUsername: string
}

export default function SettingsClient({
  initialUser,
  initialUsername,
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

      {/* Header */}
      <div className="bg-white dark:bg-[#1a1429] border-b dark:border-white/10 sticky top-0 z-10 transition-colors">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-bold flex-1 dark:text-white">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Settings Column */}
          <div className="md:col-span-2 space-y-6">

            {/* Profile Card */}
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 transition-colors">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                Profile
              </h2>
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-24 h-24 bg-purple-100 dark:bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                  <User className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user ? username : "Guest"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {user ? "Your display name" : "Log in to customize your profile"}
                </p>
              </div>
            </div>

            {/* Appearance Card */}
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 transition-colors">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                Appearance
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium dark:text-white">Theme</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the app looks</p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            {/* Notifications Card */}
            {user && (
              <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 transition-colors">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                  <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  Notifications
                </h2>
                <PushToggle userId={user.id} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  Enable push notifications to get instant alerts when someone sends you a confession.
                </p>
              </div>
            )}

            {/* Account Card */}
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 transition-colors">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <Mail className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                Account
              </h2>
              <div className="space-y-6">
                {user ? (
                  <>
                    <div className="dark:text-gray-300">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                      <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Username</p>
                      <p className="font-medium text-gray-900 dark:text-white">@{username}</p>
                    </div>
                    <div className="pt-4 border-t dark:border-white/10">
                      <LogoutButton />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Log in to access your account settings
                    </p>
                    <Link href="/login">
                      <button className="flex w-full items-center justify-center gap-3 rounded-lg px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <LogIn className="h-5 w-5" />
                        Log in
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 sticky top-24 transition-colors">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Quick links</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/dashboard" className="text-purple-600 dark:text-purple-400 hover:underline">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/inbox" className="text-purple-600 dark:text-purple-400 hover:underline">
                    Inbox
                  </Link>
                </li>
                <li className="text-gray-500 dark:text-gray-500">Privacy (soon)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Mobile-only back button */}
        <div className="fixed bottom-6 left-6 right-6 sm:hidden z-20">
          <Link
            href="/dashboard"
            className="w-full bg-white dark:bg-[#1a1429] shadow-lg rounded-xl px-6 py-4 flex items-center justify-center gap-2 font-medium text-gray-900 dark:text-white border border-gray-200 dark:border-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}


