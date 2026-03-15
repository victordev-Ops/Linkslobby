'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Copy, Check, Loader2, User as UserIcon, XCircle, CheckCircle, Camera, UserPlus, UserMinus, Users, X, Clock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { updateProfile, checkSlugAvailability } from '@/actions/profile'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import VerifiedBadge from '@/components/VerifiedBadge'
import { useDebounce } from '@/hooks/use-debounce'
import { createClient } from '@/lib/supabase/client'
import {
    sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
    type FriendshipWithProfile, type FriendProfile,
} from '@/actions/friends'

interface ProfileClientProps {
    user: any
    profile: {
        username: string
        slug: string
        email: string
        avatar_url?: string
        dms_disabled: boolean
        is_pro: boolean
    }
    initialFriends?: FriendshipWithProfile[]
    initialPendingRequests?: FriendshipWithProfile[]
    initialSuggestedFriends?: FriendProfile[]
}

export default function ProfileClient({ user, profile, initialFriends = [], initialPendingRequests = [], initialSuggestedFriends = [] }: ProfileClientProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Local state for optimistic updates
    const [displayUsername, setDisplayUsername] = useState(profile.username)
    const [displaySlug, setDisplaySlug] = useState(profile.slug)
    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null)
    const [dmsDisabled, setDmsDisabled] = useState(profile.dms_disabled)

    // Slug check states
    const [slug, setSlug] = useState(profile.slug)
    const debouncedSlug = useDebounce(slug, 500)
    const [isSlugChecking, setIsSlugChecking] = useState(false)
    const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
    const [slugMessage, setSlugMessage] = useState('')
    const [isAvatarUploading, setIsAvatarUploading] = useState(false)
    const supabaseClient = createClient()

    // Friendship state
    const [friends, setFriends] = useState<FriendshipWithProfile[]>(initialFriends)
    const [pendingRequests, setPendingRequests] = useState<FriendshipWithProfile[]>(initialPendingRequests)
    const [suggestedFriends, setSuggestedFriends] = useState<FriendProfile[]>(initialSuggestedFriends)
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

    useEffect(() => {
        // Don't check if it matches initial profile slug (unless they change back and forth, but checking against DB handles 'taken by others')
        const checkSlug = async () => {
            if (debouncedSlug === profile.slug) {
                setSlugAvailable(null)
                setSlugMessage('')
                return
            }

            setIsSlugChecking(true)
            const result = await checkSlugAvailability(debouncedSlug)
            setIsSlugChecking(false)

            setSlugAvailable(result.available)
            setSlugMessage(result.message || (result.available ? 'Available' : 'Unavailable'))
        }

        if (debouncedSlug && debouncedSlug.length >= 2) {
            checkSlug()
        } else {
            setSlugAvailable(null)
            setSlugMessage('')
        }
    }, [debouncedSlug, profile.slug])

    const copyLink = () => {
        const link = `${window.location.origin}/u/${displaySlug}`
        navigator.clipboard.writeText(link)
        setCopied(true)
        toast.success('Profile link copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault()
        copyLink()
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image size must be less than 2MB")
            return
        }

        setIsAvatarUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}-${Math.random()}.${fileExt}`
            const filePath = `avatars/${fileName}`

            const { error: uploadError } = await supabaseClient.storage
                .from('avatars')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabaseClient.storage
                .from('avatars')
                .getPublicUrl(filePath)

            // Update profile via server action
            const formData = new FormData()
            formData.append('username', displayUsername)
            formData.append('slug', displaySlug)
            formData.append('avatar_url', publicUrl)

            const result = await updateProfile(null, formData)
            if (result.error) throw new Error(result.error)

            setAvatarUrl(publicUrl)
            toast.success("Profile picture updated!")
            router.refresh()
        } catch (error: any) {
            console.error("Avatar upload error:", error)
            toast.error(error.message || "Failed to upload image")
        } finally {
            setIsAvatarUploading(false)
        }
    }

    async function clientAction(formData: FormData) {
        if (slugAvailable === false) {
            toast.error("Please choose a valid and available handle.")
            return
        }

        setIsLoading(true)
        const result = await updateProfile(null, formData)
        setIsLoading(false)

        if (result?.error) {
            toast.error(result.error)
        } else if (result?.success) {
            // Optimistic update — reflect changes immediately
            const newUsername = formData.get('username') as string
            const newSlug = formData.get('slug') as string
            const newAvatar = formData.get('avatar_url') as string
            const newDmsDisabled = formData.get('dms_disabled') === 'on'
            if (newUsername) setDisplayUsername(newUsername)
            if (newSlug) setDisplaySlug(newSlug)
            if (newAvatar !== undefined) setAvatarUrl(newAvatar)
            setDmsDisabled(newDmsDisabled)

            toast.success(result.success)
            setIsEditing(false)
            router.refresh()
        }
    }

    // ─── Friend action handlers ───
    const handleSendRequest = async (targetUserId: string) => {
        setActionLoadingId(targetUserId)
        const result = await sendFriendRequest(targetUserId)
        if (result.success) {
            setSuggestedFriends(prev => prev.filter(f => f.id !== targetUserId))
            toast.success('Friend request sent!')
        } else {
            toast.error(result.error || 'Failed to send request')
        }
        setActionLoadingId(null)
    }

    const handleAcceptRequest = async (friendshipId: string, requesterProfile: FriendProfile) => {
        setActionLoadingId(friendshipId)
        const result = await acceptFriendRequest(friendshipId)
        if (result.success) {
            setPendingRequests(prev => prev.filter(r => r.id !== friendshipId))
            // Add to friends list
            const accepted = initialPendingRequests.find(r => r.id === friendshipId)
            if (accepted) {
                setFriends(prev => [...prev, { ...accepted, status: 'accepted', profile: requesterProfile }])
            }
            toast.success('Friend request accepted!')
        } else {
            toast.error(result.error || 'Failed to accept request')
        }
        setActionLoadingId(null)
    }

    const handleDeclineRequest = async (friendshipId: string) => {
        setActionLoadingId(friendshipId)
        const result = await declineFriendRequest(friendshipId)
        if (result.success) {
            setPendingRequests(prev => prev.filter(r => r.id !== friendshipId))
            toast.success('Request declined')
        } else {
            toast.error(result.error || 'Failed to decline request')
        }
        setActionLoadingId(null)
    }

    const handleRemoveFriend = async (friendshipId: string) => {
        setActionLoadingId(friendshipId)
        const result = await removeFriend(friendshipId)
        if (result.success) {
            setFriends(prev => prev.filter(f => f.id !== friendshipId))
            toast.success('Friend removed')
        } else {
            toast.error(result.error || 'Failed to remove friend')
        }
        setActionLoadingId(null)
    }

    // ─── Avatar helper ───
    const AvatarCircle = ({ url, name, size = 'md' }: { url?: string | null; name: string; size?: 'sm' | 'md' }) => {
        const dim = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12'
        const textSize = size === 'sm' ? 'text-sm' : 'text-base'
        return url ? (
            <img src={url} alt={name} className={`${dim} rounded-full object-cover ring-2 ring-slate-100 dark:ring-white/10`} />
        ) : (
            <div className={`${dim} bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white ring-2 ring-slate-100 dark:ring-white/10`}>
                <span className={`${textSize} font-black italic`}>
                    {name ? name.charAt(0).toUpperCase() : '?'}
                </span>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">
            {/* Gradient Cover Banner */}
            <div className="h-36 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F8F9FD] dark:to-[#0f0a1e]" />
                <div className="absolute top-0 left-0 right-0 bg-black/10 backdrop-blur-sm px-4 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft size={20} className="text-white" />
                        </Link>
                        <h1 className="text-lg font-bold text-white">My Profile</h1>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-sm font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-full transition"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>
            </div>

            <main className="max-w-2xl mx-auto px-4 -mt-16 relative z-10 space-y-6">
                {/* Profile Card */}
                <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-[2.5rem] shadow-lg border border-slate-200 dark:border-white/10 p-8 flex flex-col items-center">
                    <div className="relative group mb-4">
                        <div className="w-28 h-28 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-xl ring-4 ring-white dark:ring-[#1a1429] overflow-hidden">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={displayUsername} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-black italic">
                                    {displayUsername ? displayUsername.charAt(0).toUpperCase() : "?"}
                                </span>
                            )}

                            {isAvatarUploading && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                                </div>
                            )}
                        </div>

                        <label className="absolute bottom-0 right-0 p-2.5 bg-white dark:bg-purple-600 rounded-full shadow-lg border border-slate-200 dark:border-purple-500/50 cursor-pointer hover:scale-110 active:scale-95 transition-all text-slate-600 dark:text-white">
                            <Camera size={18} />
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                disabled={isAvatarUploading}
                            />
                        </label>
                    </div>

                    {!isEditing ? (
                        <>
                            <div className="flex items-center gap-1.5 mb-1">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">
                                    @{displayUsername}
                                </h2>
                                {profile.is_pro && <VerifiedBadge size={20} />}
                            </div>
                            {!profile.is_pro && (
                                <Link
                                    href="/upgrade"
                                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-500 hover:text-blue-400 transition mb-2"
                                >
                                    <Sparkles size={12} />
                                    Get Verified
                                </Link>
                            )}
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-center mb-4">
                                {displaySlug}
                            </p>

                            {/* Stats Row */}
                            <div className="flex gap-6 mb-5">
                                <div className="text-center">
                                    <p className="text-lg font-black text-slate-900 dark:text-white">{friends.length}</p>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Friends</p>
                                </div>
                            </div>

                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            >
                                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                {copied ? 'Copied!' : 'Copy Profile Link'}
                            </button>
                        </>
                    ) : (
                        <form action={clientAction} className="w-full max-w-sm space-y-4 mt-2">
                            <div>
                                <label htmlFor="username" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    id="username"
                                    defaultValue={profile.username}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-bold transition-all"
                                    placeholder="Your username"
                                    minLength={2}
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="slug" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Unique Handle (Slug)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500 font-bold select-none">/u/</span>
                                    <input
                                        type="text"
                                        name="slug"
                                        id="slug"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value.toLowerCase())}
                                        className={`w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-50 dark:bg-black/20 border focus:outline-none focus:ring-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-bold transition-all ${slugAvailable === false
                                            ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500'
                                            : slugAvailable === true
                                                ? 'border-green-300 dark:border-green-500/50 focus:ring-green-500'
                                                : 'border-slate-200 dark:border-white/10 focus:ring-purple-500'
                                            }`}
                                        placeholder="unique-handle"
                                        minLength={2}
                                        required
                                    />
                                    <div className="absolute right-4 top-3.5 pointer-events-none">
                                        {isSlugChecking ? (
                                            <Loader2 size={16} className="animate-spin text-slate-400" />
                                        ) : slugAvailable === true ? (
                                            <CheckCircle size={16} className="text-green-500" />
                                        ) : slugAvailable === false ? (
                                            <XCircle size={16} className="text-red-500" />
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex justify-between items-start mt-1.5 ml-1">
                                    <p className="text-[10px] text-slate-400">
                                        This is your public URL. Changing this will break existing links.
                                    </p>
                                    {slugMessage && (
                                        <p className={`text-[10px] font-bold ${slugAvailable === true ? 'text-green-500' : slugAvailable === false ? 'text-red-500' : 'text-slate-400'}`}>
                                            {slugMessage}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Disable Direct Messages</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">No one will be able to start new chats with you.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        name="dms_disabled"
                                        className="sr-only peer"
                                        checked={dmsDisabled}
                                        onChange={(e) => setDmsDisabled(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 transition-colors"></div>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    disabled={isLoading}
                                    className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 py-3 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isLoading && <Loader2 size={16} className="animate-spin" />}
                                    Save Changes
                                </button>
                            </div>
                            <input type="hidden" name="avatar_url" value={avatarUrl || ''} />
                        </form>
                    )}
                </div>

                {/* Account Details (Read Only) */}
                <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <UserIcon size={16} className="text-purple-500" /> Account Details
                    </h3>

                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">Email Address</p>
                            <p className="font-bold text-slate-900 dark:text-white truncate">{profile.email}</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 text-center">
                        To change your email or password, please contact support.
                    </p>
                </div>

                {/* ─── Pending Friend Requests ─── */}
                {pendingRequests.length > 0 && (
                    <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <Clock size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Friend Requests</h3>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{pendingRequests.length} pending</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {pendingRequests.map(req => (
                                <div key={req.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <Link href={`/u/${req.profile.slug || req.profile.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                                        <AvatarCircle url={req.profile.avatar_url} name={req.profile.username} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">@{req.profile.username}</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Wants to be friends</p>
                                        </div>
                                    </Link>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => handleAcceptRequest(req.id, req.profile)}
                                            disabled={actionLoadingId === req.id}
                                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {actionLoadingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => handleDeclineRequest(req.id)}
                                            disabled={actionLoadingId === req.id}
                                            className="px-3 py-1.5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Friends List ─── */}
                <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Users size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Friends</h3>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{friends.length} friends</p>
                        </div>
                    </div>

                    {friends.length === 0 ? (
                        <div className="flex flex-col items-center py-6 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                                <Users size={28} className="text-slate-300 dark:text-white/20" />
                            </div>
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No friends yet</p>
                            <p className="text-[10px] text-slate-300 dark:text-white/20 mt-1">Add friends from the suggestions below!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {friends.map(f => (
                                <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <Link href={`/u/${f.profile.slug || f.profile.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                                        <AvatarCircle url={f.profile.avatar_url} name={f.profile.username} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">@{f.profile.username}</p>
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => handleRemoveFriend(f.id)}
                                        disabled={actionLoadingId === f.id}
                                        className="text-xs font-bold text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 disabled:opacity-50"
                                    >
                                        {actionLoadingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Suggested Friends ─── */}
                {suggestedFriends.length > 0 && (
                    <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <UserPlus size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">People You May Know</h3>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Suggested</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {suggestedFriends.map(person => (
                                <div key={person.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <Link href={`/u/${person.slug || person.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                                        <AvatarCircle url={person.avatar_url} name={person.username} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">@{person.username}</p>
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => handleSendRequest(person.id)}
                                        disabled={actionLoadingId === person.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {actionLoadingId === person.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
