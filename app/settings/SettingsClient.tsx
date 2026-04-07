"use client"

import { useState, useRef, useTransition, useEffect } from "react"
import LogoutButton from "@/components/LogoutButton"
import Link from "next/link"
import { User, Mail, ArrowLeft, LogIn, Bell, Moon, Home, Shield, Trash2, X, Plus, UserX, AlertTriangle, Loader2, Smartphone, Check, Sparkles, BadgeCheck, FileText } from "lucide-react"
import PushToggle from "@/components/PushToggle"
import { ThemeToggle } from "@/components/ThemeToggle"
import VerifiedBadge from "@/components/VerifiedBadge"
import { updateRestrictedWords, updateWatermarkSetting, updateBio } from "@/actions/profile"
import { unblockUser, unblockAnonymous } from "@/actions/blocked-users"
import { cancelSubscription, type SubscriptionInfo } from "@/actions/subscription"
import { deleteAccount } from "@/actions/auth"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useScrollLock } from "@/hooks/useScrollLock"
import { createClient } from "@/lib/supabase/client"
import type { BlockedUser, BlockedAnonymous } from "@/actions/blocked-users"

interface SettingsClientProps {
  initialUser: any
  initialUsername: string
  initialAvatarUrl?: string | null
  initialPushEnabled: boolean
  initialShowWatermark: boolean
  initialRestrictedWords: string[]
  initialBlockedUsers: BlockedUser[]
  initialBlockedAnonymous: BlockedAnonymous[]
  initialSubscription?: SubscriptionInfo | null
  isPro?: boolean
  initialBio?: string
}

export default function SettingsClient({
  initialUser,
  initialUsername,
  initialAvatarUrl,
  initialPushEnabled,
  initialShowWatermark,
  initialRestrictedWords,
  initialBlockedUsers,
  initialBlockedAnonymous,
  initialSubscription,
  isPro,
}: SettingsClientProps) {
  const user = initialUser
  const [username, setUsername] = useState(initialUsername)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const router = useRouter()
  const supabase = createClient()

  // Hydrate profile data on mount to ensure freshness across navigation
  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            if (data.username) setUsername(data.username)
            if (data.avatar_url !== undefined) setAvatarUrl(data.avatar_url)
          }
        })
    }
  }, [user?.id, supabase])

  // Watermark state
  const [showWatermark, setShowWatermark] = useState(initialShowWatermark)
  const [isUpdatingWatermark, setIsUpdatingWatermark] = useState(false)

  // Restricted words state
  const [words, setWords] = useState<string[]>(initialRestrictedWords)
  const [wordInput, setWordInput] = useState("")
  const [isSavingWords, startSavingWords] = useTransition()

  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>(initialBlockedUsers)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  // Blocked anonymous state
  const [blockedAnon, setBlockedAnon] = useState<BlockedAnonymous[]>(initialBlockedAnonymous)
  const [unblockingAnonId, setUnblockingAnonId] = useState<string | null>(null)

  // Subscription state
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(initialSubscription || null)
  const [isCancelling, setIsCancelling] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Scroll Lock for delete modal
  useScrollLock(showDeleteModal)

  const handleCancelSubscription = async () => {
    setIsCancelling(true)
    try {
      const result = await cancelSubscription()
      if (result.success) {
        setSubscription(prev => prev ? { ...prev, cancel_at_period_end: true } : null)
        toast.success("Subscription will cancel at end of billing period")
      } else {
        toast.error(result.error || "Failed to cancel subscription")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsCancelling(false)
    }
  }

  const addWord = () => {
    const w = wordInput.toLowerCase().trim()
    if (!w || words.includes(w) || words.length >= 50) return
    const newWords = [...words, w]
    setWords(newWords)
    setWordInput("")
    startSavingWords(async () => {
      const result = await updateRestrictedWords(newWords)
      if (!result.success) toast.error("Failed to save word filter")
    })
  }

  const removeWord = (word: string) => {
    const newWords = words.filter(w => w !== word)
    setWords(newWords)
    startSavingWords(async () => {
      const result = await updateRestrictedWords(newWords)
      if (!result.success) toast.error("Failed to save word filter")
    })
  }

  const handleUnblock = async (blockedId: string) => {
    setUnblockingId(blockedId)
    const result = await unblockUser(blockedId)
    if (result.success) {
      setBlockedUsers(prev => prev.filter(u => u.blocked_id !== blockedId))
      toast.success("User unblocked")
    } else {
      toast.error("Failed to unblock user")
    }
    setUnblockingId(null)
  }

  const handleUnblockAnonymous = async (id: string) => {
    setUnblockingAnonId(id)
    const result = await unblockAnonymous(id)
    if (result.success) {
      setBlockedAnon(prev => prev.filter(a => a.id !== id))
      toast.success("Anonymous sender unblocked")
    } else {
      toast.error("Failed to unblock")
    }
    setUnblockingAnonId(null)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return
    setIsDeleting(true)
    try {
      const result = await deleteAccount()
      if (result.success) {
        toast.success("Account deleted. Goodbye!")
        router.push("/login")
      } else {
        toast.error(result.message || "Failed to delete account")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          {/* Main Settings Column */}
          <div className="md:col-span-2 space-y-4 sm:space-y-6">

            {/* Profile Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all hover:shadow-md">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={username}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-[#1a1429] object-cover relative z-10 shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-[#1a1429]">
                      <span className="text-2xl sm:text-3xl font-black italic">
                        {user && username ? username.charAt(0).toUpperCase() : "?"}
                      </span>
                    </div>
                  )}
                  {user && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-[#1a1429] flex items-center justify-center z-20">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                      {user ? `@${username}` : "Guest Explorer"}
                    </h2>
                    {isPro && <VerifiedBadge size={20} />}
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    {user ? user.email : "Log in to save your settings"}
                  </p>
                  {user && !isPro && (
                    <Link href="/upgrade" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-600 transition">
                      <BadgeCheck size={14} /> Get Verified
                    </Link>
                  )}
                  {!user && (
                    <Link href="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 transition">
                      Join now <LogIn size={16} />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Subscription Card */}
            {user && (
              <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <BadgeCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Subscription</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">
                      {subscription?.status === 'active' ? 'Pro Plan' : 'Free Plan'}
                    </p>
                  </div>
                </div>

                {subscription && ['active', 'trialing'].includes(subscription.status) ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/5 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-amber-500" />
                        <span className="text-sm font-black text-amber-700 dark:text-amber-300">Pro Active</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider mb-0.5">Plan</p>
                          <p className="font-bold text-gray-900 dark:text-white capitalize">{subscription.plan}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider mb-0.5">Provider</p>
                          <p className="font-bold text-gray-900 dark:text-white capitalize">{subscription.provider}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider mb-0.5">
                            {subscription.cancel_at_period_end ? 'Expires on' : 'Renews on'}
                          </p>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {subscription.current_period_end
                              ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {subscription.cancel_at_period_end ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                        Your subscription will not renew after the current period.
                      </p>
                    ) : (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={isCancelling}
                        className="w-full py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isCancelling ? <Loader2 size={16} className="animate-spin" /> : null}
                        {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Unlock premium features with Say Pro
                    </p>
                    <Link
                      href="/upgrade"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-400 to-blue-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all active:scale-95"
                    >
                      <VerifiedBadge size={16} />
                      Get Verified
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Appearance Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all">
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
              <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Stay Updated</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">Notifications</p>
                  </div>
                </div>
                <PushToggle userId={user.id} initialPushEnabled={initialPushEnabled} />

                <div className="mt-8 pt-8 border-t dark:border-white/10 space-y-4">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">More Updates</p>

                  <Link href="/subscribe" className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Mail size={16} />
                      </div>
                      <span className="font-bold text-sm dark:text-white">Subscribe to email</span>
                    </div>
                    <div className="px-3 py-1 bg-white dark:bg-white/10 rounded-lg text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:scale-105 transition-all">
                      Coming Soon
                    </div>
                  </Link>

                  <Link href="/download" className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Smartphone size={16} />
                      </div>
                      <span className="font-bold text-sm dark:text-white">Download App</span>
                    </div>
                    <div className="px-3 py-1 bg-white dark:bg-white/10 rounded-lg text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:scale-105 transition-all">
                      PWA Ready
                    </div>
                  </Link>
                </div>
              </div>
            )}

            {/* Content Filter Card */}
            {user && (
              <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Content Privacy</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">Watermark & Filters</p>
                  </div>
                </div>

                {/* Watermark Toggle */}
                <div className="mb-8 p-4 bg-orange-50/50 dark:bg-orange-500/5 rounded-2xl border border-orange-100 dark:border-orange-500/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-gray-900 dark:text-white">Show Watermark</p>
                        {!isPro && (
                          <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Display "say-app.com" on shared stories</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!isPro) return
                        const next = !showWatermark
                        setShowWatermark(next)
                        setIsUpdatingWatermark(true)
                        const res = await updateWatermarkSetting(next)
                        if (!res.success) {
                          toast.error("Failed to update setting")
                          setShowWatermark(!next)
                        }
                        setIsUpdatingWatermark(false)
                      }}
                      disabled={isUpdatingWatermark || !isPro}
                      className={`w-12 h-6 rounded-full transition-all relative ${!isPro ? 'bg-gray-200 dark:bg-white/10 opacity-50 cursor-not-allowed' : showWatermark ? 'bg-orange-500' : 'bg-gray-200 dark:bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${showWatermark ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  {!isPro && (
                    <Link href="/upgrade" className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-blue-500 hover:text-blue-600 transition">
                      <BadgeCheck size={13} /> Upgrade to Pro to toggle watermark off
                    </Link>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Words added here will be blurred in messages you receive. Hover to reveal.
                </p>

                {/* Word input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={wordInput}
                    onChange={e => setWordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWord() } }}
                    placeholder="Add a word..."
                    maxLength={30}
                    className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400/40 transition-all"
                  />
                  <button
                    onClick={addWord}
                    disabled={!wordInput.trim() || words.length >= 50}
                    className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>

                {/* Word chips */}
                {words.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {words.map(word => (
                      <span
                        key={word}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold border border-orange-200 dark:border-orange-500/20"
                      >
                        {word}
                        <button
                          onClick={() => removeWord(word)}
                          className="hover:text-red-500 transition-colors"
                          aria-label={`Remove ${word}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {isSavingWords && <Loader2 size={14} className="text-gray-400 animate-spin self-center" />}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-600 italic">No restricted words yet</p>
                )}
                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-3">{words.length}/50 words</p>
              </div>
            )}

            {/* Blocked Users Card */}
            {user && (
              <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                    <UserX size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Blocked Users</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">{blockedUsers.length} blocked</p>
                  </div>
                </div>

                {blockedUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600 italic">You haven't blocked anyone yet.</p>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(bu => (
                      <div
                        key={bu.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-white font-black text-sm">
                            {bu.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-sm text-gray-900 dark:text-white">@{bu.username}</span>
                        </div>
                        <button
                          onClick={() => handleUnblock(bu.blocked_id)}
                          disabled={unblockingId === bu.blocked_id}
                          className="text-xs font-bold text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 disabled:opacity-50"
                        >
                          {unblockingId === bu.blocked_id ? <Loader2 size={14} className="animate-spin" /> : 'Unblock'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Blocked Anonymous Senders Card */}
            {user && (
              <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Blocked Senders</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">{blockedAnon.length} anonymous blocked</p>
                  </div>
                </div>

                {blockedAnon.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600 italic">No anonymous senders blocked.</p>
                ) : (
                  <div className="space-y-2">
                    {blockedAnon.map(ba => (
                      <div
                        key={ba.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-sm">
                            ?
                          </div>
                          <div>
                            <span className="font-bold text-sm text-gray-900 dark:text-white">{ba.label}</span>
                            <p className="text-[10px] text-gray-400 dark:text-gray-600">
                              {new Date(ba.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnblockAnonymous(ba.id)}
                          disabled={unblockingAnonId === ba.id}
                          className="text-xs font-bold text-orange-500 hover:text-orange-700 dark:hover:text-orange-300 transition-colors px-3 py-1.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-500/10 active:scale-95 disabled:opacity-50"
                        >
                          {unblockingAnonId === ba.id ? <Loader2 size={14} className="animate-spin" /> : 'Unblock'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Account Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 p-6 sm:p-8 transition-all">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1">Email Address</p>
                        <p className="font-bold text-gray-900 dark:text-white truncate text-sm sm:text-base">{user.email}</p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1">Public Handle</p>
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">@{username}</p>
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

            {/* Danger Zone */}
            {user && (
              <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-red-100 dark:border-red-500/20 p-6 sm:p-8 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                    <p className="text-xs text-red-400 dark:text-red-500 font-medium uppercase tracking-wider">Irreversible actions</p>
                  </div>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/10 mb-4">
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">
                    Deleting your account is permanent. All your messages, XP, and data will be erased and cannot be recovered.
                  </p>
                </div>

                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-3.5 rounded-2xl border-2 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete My Account
                </button>
              </div>
            )}
          </div>

          {/* Sidebar / Quick Nav */}
          <div className="md:col-span-1 order-first md:order-last">
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/10 p-4 sm:p-6 sticky md:top-28 transition-all">
              <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 ml-2">Quick Navigation</h3>

              {/* Desktop: Vertical list, Mobile: Horizontal scrollable */}
              <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-2 no-scrollbar">
                {[
                  { name: 'Dashboard', href: '/dashboard', label: 'Home', icon: Home },
                  { name: 'Inbox', href: '/inbox', label: 'Inbox', icon: Mail },
                  { name: 'Profile', href: '/profile', label: 'Public', icon: User },
                ].map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="flex-shrink-0 flex items-center gap-3 p-3 px-4 md:px-3 rounded-2xl md:rounded-xl bg-gray-50 md:bg-transparent dark:bg-white/5 md:dark:bg-transparent hover:bg-white dark:hover:bg-white/10 md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-all group border border-gray-100 dark:border-white/5 md:border-transparent min-w-[120px] md:min-w-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      <link.icon size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">{link.name}</span>
                      <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 hidden md:inline">{link.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile back button */}
        <div className="fixed bottom-24 left-6 right-6 sm:hidden z-20 pointer-events-none">
          <Link
            href="/dashboard"
            className="pointer-events-auto float-right w-14 h-14 bg-white dark:bg-[#1a1429] shadow-2xl rounded-2xl flex items-center justify-center text-gray-900 dark:text-white border border-gray-100 dark:border-white/10 active:scale-95 transition-all"
          >
            <Home className="h-6 w-6" />
          </Link>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-[#1a1429] rounded-[2rem] shadow-2xl border border-red-100 dark:border-red-500/20 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-center text-gray-900 dark:text-white mb-2">Delete Account?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              This is permanent and cannot be undone. Type <strong className="text-red-500">DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/40 mb-4 transition-all"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm("") }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE" || isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
