"use client"

import { useState, useTransition, useEffect } from "react"
import LogoutButton from "@/components/LogoutButton"
import Link from "next/link"
import {
  User, Mail, ArrowLeft, LogIn, Bell, Moon, Home, Shield,
  Trash2, X, Plus, UserX, AlertTriangle, Loader2, Smartphone,
  BadgeCheck, ChevronRight, Eye, EyeOff, Sparkles, FileText,
  HelpCircle, Lock, Pause, Filter, Crown
} from "lucide-react"
import PushToggle from "@/components/PushToggle"
import { ThemeToggle } from "@/components/ThemeToggle"
import VerifiedBadge from "@/components/VerifiedBadge"
import { updateRestrictedWords, updateWatermarkSetting } from "@/actions/profile"
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

// ── Reusable row component ──────────────────────────────────────────────────
function SettingsRow({
  icon,
  iconBg = "bg-gray-100 dark:bg-white/10",
  iconColor = "text-gray-600 dark:text-white",
  label,
  sublabel,
  right,
  onClick,
  href,
  destructive,
}: {
  icon: React.ReactNode
  iconBg?: string
  iconColor?: string
  label: string
  sublabel?: string
  right?: React.ReactNode
  onClick?: () => void
  href?: string
  destructive?: boolean
}) {
  const inner = (
    <div
      onClick={onClick}
      className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors
        ${onClick || href ? "cursor-pointer active:bg-black/5 dark:active:bg-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" : ""}
      `}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${destructive ? "text-red-500 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-gray-400 dark:text-white/35 mt-0.5 leading-tight">{sublabel}</p>
        )}
      </div>
      {right !== undefined ? right : (onClick || href) ? (
        <ChevronRight size={16} className="text-gray-300 dark:text-white/20 shrink-0" />
      ) : null}
    </div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return inner
}

// ── Section wrapper ─────────────────────────────────────────────────────────
function SettingsSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/30 mb-2 px-1">
        {label}
      </p>
      <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
        {children}
      </div>
    </div>
  )
}

// ── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="h-px bg-gray-100 dark:bg-white/[0.06]" />
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

  // Panels
  type Panel = "notifications" | "appearance" | "hidden-words" | "blocked-users" | "blocked-anon" | "subscription" | null
  const [activePanel, setActivePanel] = useState<Panel>(null)

  useScrollLock(activePanel !== null)

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
  }, [user?.id])

  // Watermark
  const [showWatermark, setShowWatermark] = useState(initialShowWatermark)
  const [isUpdatingWatermark, setIsUpdatingWatermark] = useState(false)

  // Restricted words
  const [words, setWords] = useState<string[]>(initialRestrictedWords)
  const [wordInput, setWordInput] = useState("")
  const [isSavingWords, startSavingWords] = useTransition()

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>(initialBlockedUsers)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  // Blocked anon
  const [blockedAnon, setBlockedAnon] = useState<BlockedAnonymous[]>(initialBlockedAnonymous)
  const [unblockingAnonId, setUnblockingAnonId] = useState<string | null>(null)

  // Subscription
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(initialSubscription || null)
  const [isCancelling, setIsCancelling] = useState(false)

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
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

  // ── Panel slide-in ────────────────────────────────────────────────────────
  const Panel = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-[#0f0a1e] flex flex-col animate-in slide-in-from-right-full duration-300">
      <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-white active:scale-90 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="font-bold text-gray-900 dark:text-white text-base">{title}</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {children}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] transition-colors duration-300 pb-10">

      {/* Ambient BG */}
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/10 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-white active:scale-90 transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-gray-900 dark:text-white text-base">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 relative z-10">

        {/* Profile card */}
        <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] p-4 flex items-center gap-3.5">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500/20" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-xl ring-2 ring-purple-500/20">
                {username?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            {user && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-[#1a1429]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-gray-900 dark:text-white text-base leading-none truncate">
                {user ? username : "Guest"}
              </p>
              {isPro && <VerifiedBadge size={16} />}
            </div>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5 truncate">
              {user ? user.email : "Not signed in"}
            </p>
          </div>
          {user && !isPro && (
            <Link
              href="/upgrade"
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-black"
            >
              <VerifiedBadge size={16} /> Get verified 
            </Link>
          )}
        </div>

        {/* Preferences */}
        <SettingsSection label="Preferences">
          <SettingsRow
            icon={<Bell size={16} />}
            iconBg="bg-blue-100 dark:bg-blue-500/20"
            iconColor="text-blue-600 dark:text-blue-400"
            label="Notifications"
            sublabel="Push alerts for new messages"
            onClick={() => setActivePanel("notifications")}
          />
          <SettingsRow
            icon={<Moon size={16} />}
            iconBg="bg-purple-100 dark:bg-purple-500/20"
            iconColor="text-purple-600 dark:text-purple-400"
            label="Appearance"
            sublabel="Light, dark, or system theme"
            onClick={() => setActivePanel("appearance")}
          />
        </SettingsSection>

        {/* Safety controls */}
        {user && (
          <SettingsSection label="Safety controls">
            <SettingsRow
              icon={<Filter size={16} />}
              iconBg="bg-orange-100 dark:bg-orange-500/20"
              iconColor="text-orange-600 dark:text-orange-400"
              label="Hidden words"
              sublabel={`${words.length} filtered word${words.length !== 1 ? "s" : ""}`}
              onClick={() => setActivePanel("hidden-words")}
            />
            <SettingsRow
              icon={<UserX size={16} />}
              iconBg="bg-red-100 dark:bg-red-500/20"
              iconColor="text-red-600 dark:text-red-400"
              label="Blocked users"
              sublabel={blockedUsers.length > 0 ? `${blockedUsers.length} blocked` : "No blocked users"}
              onClick={() => setActivePanel("blocked-users")}
            />
            <SettingsRow
              icon={<Shield size={16} />}
              iconBg="bg-amber-100 dark:bg-amber-500/20"
              iconColor="text-amber-600 dark:text-amber-400"
              label="Blocked senders"
              sublabel={blockedAnon.length > 0 ? `${blockedAnon.length} anonymous blocked` : "No blocked senders"}
              onClick={() => setActivePanel("blocked-anon")}
            />
            <SettingsRow
              icon={isPro ? <EyeOff size={16} /> : <Eye size={16} />}
              iconBg="bg-slate-100 dark:bg-white/10"
              iconColor="text-slate-600 dark:text-white/60"
              label="Watermark on shares"
              sublabel={isPro ? "Toggle watermark visibility" : "Pro feature"}
              right={
                isPro ? (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
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
                    disabled={isUpdatingWatermark}
                    className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${showWatermark ? "bg-orange-500" : "bg-gray-200 dark:bg-white/10"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${showWatermark ? "left-6" : "left-1"}`} />
                  </button>
                ) : (
                  <Link href="/upgrade" onClick={e => e.stopPropagation()} className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-500/20">
                    Pro
                  </Link>
                )
              }
            />
          </SettingsSection>
        )}

        {/* Subscription */}
        {user && (
          <SettingsSection label="Subscription">
            {isPro && subscription ? (
              <SettingsRow
                icon={<Sparkles size={16} />}
                iconBg="bg-amber-100 dark:bg-amber-500/20"
                iconColor="text-amber-600 dark:text-amber-400"
                label="Say Pro"
                sublabel={
                  subscription.cancel_at_period_end
                    ? `Expires ${new Date(subscription.current_period_end!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : `Renews ${new Date(subscription.current_period_end!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                }
                onClick={() => setActivePanel("subscription")}
              />
            ) : isPro ? (
              <SettingsRow
                icon={<Sparkles size={16} />}
                iconBg="bg-amber-100 dark:bg-amber-500/20"
                iconColor="text-amber-600 dark:text-amber-400"
                label="Manage subscription"
                sublabel="View or modify your Say Pro plan"
                href="/upgrade"
              />
            ) : (
              <SettingsRow
                icon={<Crown size={16} />}
                iconBg="bg-blue-100 dark:bg-blue-500/20"
                iconColor="text-blue-600 dark:text-blue-400"
                label="Upgrade to Pro"
                sublabel="Verified badge, 2× XP, reveal senders & more"
                href="/upgrade"
              />
            )}
          </SettingsSection>
        )}

        {/* More */}
        <SettingsSection label="More">
          <SettingsRow
            icon={<HelpCircle size={16} />}
            iconBg="bg-teal-100 dark:bg-teal-500/20"
            iconColor="text-teal-600 dark:text-teal-400"
            label="I need help"
            sublabel="Contact support"
            href="/help"
          />
          <SettingsRow
            icon={<Shield size={16} />}
            iconBg="bg-green-100 dark:bg-green-500/20"
            iconColor="text-green-600 dark:text-green-400"
            label="Safety resources"
            href="/safety"
          />
          <SettingsRow
            icon={<FileText size={16} />}
            iconBg="bg-gray-100 dark:bg-white/10"
            iconColor="text-gray-500 dark:text-white/50"
            label="Terms of use"
            href="/terms"
          />
          <SettingsRow
            icon={<Lock size={16} />}
            iconBg="bg-gray-100 dark:bg-white/10"
            iconColor="text-gray-500 dark:text-white/50"
            label="Privacy policy"
            href="/privacy"
          />
          <SettingsRow
            icon={<Smartphone size={16} />}
            iconBg="bg-indigo-100 dark:bg-indigo-500/20"
            iconColor="text-indigo-600 dark:text-indigo-400"
            label="Download App"
            sublabel="PWA ready"
            href="/download"
          />
        </SettingsSection>

        {/* Account */}
        {user && (
          <SettingsSection label="Account">
            <div className="px-4 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/30 mb-0.5">Email</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.email}</p>
              </div>
              <div className="shrink-0">
                <LogoutButton />
              </div>
            </div>
            <Divider />
            <SettingsRow
              icon={<Trash2 size={16} />}
              iconBg="bg-red-100 dark:bg-red-500/10"
              iconColor="text-red-500"
              label="Delete account"
              sublabel="Permanently erase all your data"
              destructive
              onClick={() => setShowDeleteModal(true)}
            />
          </SettingsSection>
        )}

        {!user && (
          <SettingsSection label="Account">
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-500 dark:text-white/40 mb-4">Sign in to save your settings</p>
              <Link href="/login" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-sm rounded-xl active:scale-95 transition-all">
                <LogIn size={16} /> Sign in
              </Link>
            </div>
          </SettingsSection>
        )}

      </div>

      {/* ── Slide-in Panels ───────────────────────────────────────────────── */}

      {activePanel === "notifications" && (
        <Panel title="Notifications" onClose={() => setActivePanel(null)}>
          {user ? (
            <>
              <SettingsSection label="Push notifications">
                <div className="px-4 py-4">
                  <PushToggle userId={user.id} initialPushEnabled={initialPushEnabled} />
                </div>
              </SettingsSection>
              <SettingsSection label="More updates">
                <SettingsRow
                  icon={<Mail size={16} />}
                  iconBg="bg-blue-100 dark:bg-blue-500/20"
                  iconColor="text-blue-600 dark:text-blue-400"
                  label="Email digest"
                  sublabel="Coming soon"
                  right={<span className="text-[10px] font-black text-gray-400 dark:text-white/30 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-full">Soon</span>}
                />
              </SettingsSection>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Sign in to manage notifications</p>
          )}
        </Panel>
      )}

      {activePanel === "appearance" && (
        <Panel title="Appearance" onClose={() => setActivePanel(null)}>
          <SettingsSection label="Theme">
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Theme mode</p>
                <p className="text-xs text-gray-400 dark:text-white/35 mt-0.5">Light, dark, or follow system</p>
              </div>
              <ThemeToggle />
            </div>
          </SettingsSection>
        </Panel>
      )}

      {activePanel === "hidden-words" && (
        <Panel title="Hidden words" onClose={() => setActivePanel(null)}>
          <SettingsSection label="Word filter">
            <div className="px-4 py-4 space-y-4">
              <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">
                Words added here will be blurred in messages you receive. Tap to reveal.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={wordInput}
                  onChange={e => setWordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWord() } }}
                  placeholder="Add a word..."
                  maxLength={30}
                  className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all"
                />
                <button
                  onClick={addWord}
                  disabled={!wordInput.trim() || words.length >= 50}
                  className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Plus size={15} /> Add
                </button>
              </div>
              {words.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {words.map(word => (
                    <span key={word} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold border border-orange-200 dark:border-orange-500/20">
                      {word}
                      <button onClick={() => removeWord(word)} className="hover:text-red-500 transition-colors">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {isSavingWords && <Loader2 size={13} className="text-gray-400 animate-spin self-center" />}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-white/25 italic">No restricted words yet</p>
              )}
              <p className="text-[10px] text-gray-400 dark:text-white/25">{words.length}/50 words used</p>
            </div>
          </SettingsSection>
        </Panel>
      )}

      {activePanel === "blocked-users" && (
        <Panel title="Blocked users" onClose={() => setActivePanel(null)}>
          <SettingsSection label={`${blockedUsers.length} blocked`}>
            {blockedUsers.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-white/30 italic">You haven't blocked anyone yet.</p>
              </div>
            ) : (
              blockedUsers.map(bu => (
                <div key={bu.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {bu.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">@{bu.username}</span>
                  <button
                    onClick={() => handleUnblock(bu.blocked_id)}
                    disabled={unblockingId === bu.blocked_id}
                    className="text-xs font-bold text-red-500 px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {unblockingId === bu.blocked_id ? <Loader2 size={13} className="animate-spin" /> : "Unblock"}
                  </button>
                </div>
              ))
            )}
          </SettingsSection>
        </Panel>
      )}

      {activePanel === "blocked-anon" && (
        <Panel title="Blocked senders" onClose={() => setActivePanel(null)}>
          <SettingsSection label={`${blockedAnon.length} anonymous blocked`}>
            {blockedAnon.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-white/30 italic">No anonymous senders blocked.</p>
              </div>
            ) : (
              blockedAnon.map(ba => (
                <div key={ba.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-sm shrink-0">?</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ba.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-white/30">{new Date(ba.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleUnblockAnonymous(ba.id)}
                    disabled={unblockingAnonId === ba.id}
                    className="text-xs font-bold text-orange-500 px-3 py-1.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-500/10 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {unblockingAnonId === ba.id ? <Loader2 size={13} className="animate-spin" /> : "Unblock"}
                  </button>
                </div>
              ))
            )}
          </SettingsSection>
        </Panel>
      )}

      {activePanel === "subscription" && subscription && (
        <Panel title="Subscription" onClose={() => setActivePanel(null)}>
          <SettingsSection label="Plan details">
            <div className="px-4 py-4 space-y-4">
              <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/5 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-amber-500" />
                  <span className="text-sm font-black text-amber-700 dark:text-amber-300">Pro Active</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-white/30 font-black uppercase tracking-wider mb-0.5">Plan</p>
                    <p className="font-bold text-gray-900 dark:text-white capitalize">{subscription.plan}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-white/30 font-black uppercase tracking-wider mb-0.5">Provider</p>
                    <p className="font-bold text-gray-900 dark:text-white capitalize">{subscription.provider}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-500 dark:text-white/30 font-black uppercase tracking-wider mb-0.5">
                      {subscription.cancel_at_period_end ? "Expires on" : "Renews on"}
                    </p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        : "—"}
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
                  className="w-full py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCancelling ? <Loader2 size={15} className="animate-spin" /> : null}
                  {isCancelling ? "Cancelling..." : "Cancel subscription"}
                </button>
              )}
            </div>
          </SettingsSection>
        </Panel>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-[#1a1429] rounded-3xl shadow-2xl border border-red-100 dark:border-red-500/20 w-full max-w-sm p-7 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="text-lg font-black text-center text-gray-900 dark:text-white mb-1">Delete account?</h2>
            <p className="text-sm text-gray-500 dark:text-white/40 text-center mb-5">
              This is permanent and cannot be undone. Type <strong className="text-red-500">DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 mb-4 transition-all"
            />
            <div className="flex gap-2.5">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm("") }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/50 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE" || isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
