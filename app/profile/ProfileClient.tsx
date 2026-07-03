'use client'

import { useState, useEffect } from 'react'
import { Space_Grotesk, Inter } from 'next/font/google'
import { ArrowLeft, Save, Copy, Check, Loader2, User as UserIcon, XCircle, CheckCircle, Camera, UserPlus, Users, X, Clock, BadgeCheck, Send, ChevronDown, Search } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { updateProfile, checkSlugAvailability, updateBio } from '@/actions/profile'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import VerifiedBadge from '@/components/VerifiedBadge'
import XPBalance from '@/components/XPBalance'
import { useDebounce } from '@/hooks/use-debounce'
import { createClient } from '@/lib/supabase/client'
import {
    sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
    type FriendshipWithProfile, type FriendProfile,
} from '@/actions/friends'

// Same two-role type system as the dashboard: Space Grotesk for headings/names,
// Inter for body copy. Kept here so this file works standalone — ideally these
// live in app/layout.tsx so Next can inject the CSS vars globally.
const display = Space_Grotesk({
    subsets: ['latin'],
    weight: ['500', '600', '700'],
    variable: '--font-display',
})
const body = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-body',
})

interface ProfileClientProps {
    user: any
    profile: {
        username: string
        slug: string
        email: string
        avatar_url?: string
        cover_url?: string
        dms_disabled: boolean
        is_pro: boolean
        bio?: string
    }
    initialFriends?: FriendshipWithProfile[]
    initialPendingRequests?: FriendshipWithProfile[]
    initialSuggestedFriends?: FriendProfile[]
    initialSentRequests?: FriendshipWithProfile[]
}

export default function ProfileClient({ 
    user, 
    profile, 
    initialFriends = [], 
    initialPendingRequests = [], 
    initialSuggestedFriends = [],
    initialSentRequests = []
}: ProfileClientProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Local state for optimistic updates
    const [displayUsername, setDisplayUsername] = useState(profile.username)
    const [displaySlug, setDisplaySlug] = useState(profile.slug)
    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null)
    const [coverUrl, setCoverUrl] = useState(profile.cover_url || null)
    const [dmsDisabled, setDmsDisabled] = useState(profile.dms_disabled)
    const [displayBio, setDisplayBio] = useState(profile.bio || '')

    // Slug check states
    const [slug, setSlug] = useState(profile.slug)
    const debouncedSlug = useDebounce(slug, 500)
    const [isSlugChecking, setIsSlugChecking] = useState(false)
    const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
    const [slugMessage, setSlugMessage] = useState('')
    const [isAvatarUploading, setIsAvatarUploading] = useState(false)
    const [isCoverUploading, setIsCoverUploading] = useState(false)
    const supabaseClient = createClient()

    // Bio edit state
    const [bioInput, setBioInput] = useState(profile.bio || '')

    // Friendship state
    const [friends, setFriends] = useState<FriendshipWithProfile[]>(initialFriends)
    const [pendingRequests, setPendingRequests] = useState<FriendshipWithProfile[]>(initialPendingRequests)
    const [suggestedFriends, setSuggestedFriends] = useState<FriendProfile[]>(initialSuggestedFriends)
    const [sentRequests, setSentRequests] = useState<FriendshipWithProfile[]>(initialSentRequests)
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
    
    const [activeTab, setActiveTab] = useState<'friends' | 'suggestions' | 'requests' | 'sent'>('friends')

    // Friends section UX — collapsible group with a dropdown sub-view picker and search
    const [isFriendsSectionOpen, setIsFriendsSectionOpen] = useState(true)
    const [isFriendsDropdownOpen, setIsFriendsDropdownOpen] = useState(false)
    const [isFriendSearchOpen, setIsFriendSearchOpen] = useState(false)
    const [friendSearchQuery, setFriendSearchQuery] = useState('')

    // On mount or active tab change, if a tab is empty but another isn't, maybe we want to smart switch but let's keep it simple.
    // If user clicks from another page with requests, show requests tab by default if there are any
    useEffect(() => {
        if (initialPendingRequests.length > 0 && initialFriends.length === 0) {
            setActiveTab('requests');
        }
    }, [])

    useEffect(() => {
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

            const formData = new FormData()
            formData.append('username', displayUsername)
            formData.append('slug', displaySlug)
            formData.append('avatar_url', publicUrl)
            formData.append('scope', 'image')

            const result = await updateProfile(null, formData)
            if (result.error) throw new Error(result.error)

            setAvatarUrl(publicUrl)
            router.refresh()
        } catch (error: any) {
            console.error("Avatar upload error:", error)
            toast.error(error.message || "Failed to upload image")
        } finally {
            setIsAvatarUploading(false)
        }
    }

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image size must be less than 2MB")
            return
        }

        setIsCoverUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}-${Math.random()}.${fileExt}`
            const filePath = `covers/${fileName}`

            const { error: uploadError } = await supabaseClient.storage
                .from('covers')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabaseClient.storage
                .from('covers')
                .getPublicUrl(filePath)

            const formData = new FormData()
            formData.append('username', displayUsername)
            formData.append('slug', displaySlug)
            formData.append('cover_url', publicUrl)
            formData.append('scope', 'image')

            const result = await updateProfile(null, formData)
            if (result.error) throw new Error(result.error)

            setCoverUrl(publicUrl)
            router.refresh()
        } catch (error: any) {
            console.error("Cover upload error:", error)
            toast.error(error.message || "Failed to upload cover photo")
        } finally {
            setIsCoverUploading(false)
        }
    }

    async function clientAction(formData: FormData) {
        if (slugAvailable === false) {
            toast.error("Please choose a valid and available handle.")
            return
        }

        setIsLoading(true)
        
        // Handle Bio Update if changed
        if (bioInput !== displayBio) {
            const bioResult = await updateBio(bioInput)
            if (bioResult.error) {
                toast.error(bioResult.error)
            } else {
                setDisplayBio(bioInput)
            }
        }

        const result = await updateProfile(null, formData)
        setIsLoading(false)

        if (result?.error) {
            toast.error(result.error)
        } else if (result?.success) {
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

    // ─── Friend action handlers (OPTIMISTIC) ───
    const handleSendRequest = async (targetProfile: FriendProfile) => {
        setActionLoadingId(targetProfile.id)
        
        // Optimistic UI updates
        setSuggestedFriends(prev => prev.filter(f => f.id !== targetProfile.id))
        const optimisticReq: FriendshipWithProfile = {
            id: `temp-${Date.now()}`,
            requester_id: user.id,
            addressee_id: targetProfile.id,
            status: 'pending',
            created_at: new Date().toISOString(),
            profile: targetProfile
        }
        setSentRequests(prev => [optimisticReq, ...prev])

        const result = await sendFriendRequest(targetProfile.id)
        if (result.success) {
        
            router.refresh() // To get real ID instead of temp
        } else {
            // Revert
            setSentRequests(prev => prev.filter(r => r.id !== optimisticReq.id))
            setSuggestedFriends(prev => [targetProfile, ...prev])
            toast.error(result.error || 'Failed to send request')
        }
        setActionLoadingId(null)
    }

    const handleAcceptRequest = async (request: FriendshipWithProfile) => {
        setActionLoadingId(request.id)
        
        // Optimistic UI updates
        setPendingRequests(prev => prev.filter(r => r.id !== request.id))
        setFriends(prev => [{ ...request, status: 'accepted' }, ...prev])

        const result = await acceptFriendRequest(request.id)
        if (result.success) {
            
        } else {
            // Revert
            setFriends(prev => prev.filter(f => f.id !== request.id))
            setPendingRequests(prev => [request, ...prev])
            toast.error(result.error || 'Failed to accept request')
        }
        setActionLoadingId(null)
    }

    const handleDeclineRequest = async (request: FriendshipWithProfile) => {
        setActionLoadingId(request.id)
        
        // Optimistic UI update
        setPendingRequests(prev => prev.filter(r => r.id !== request.id))
        
        const result = await declineFriendRequest(request.id)
        if (result.success) {
            toast.success('Request declined')
        } else {
            // Revert
            setPendingRequests(prev => [request, ...prev])
            toast.error(result.error || 'Failed to decline request')
        }
        setActionLoadingId(null)
    }

    const handleRemoveFriend = async (friendship: FriendshipWithProfile) => {
        setActionLoadingId(friendship.id)
        
        // Optimistic UI
        setFriends(prev => prev.filter(f => f.id !== friendship.id))
        
        const result = await removeFriend(friendship.id)
        if (result.success) {
            toast.success('Friend removed')
        } else {
            // Revert
            setFriends(prev => [friendship, ...prev])
            toast.error(result.error || 'Failed to remove friend')
        }
        setActionLoadingId(null)
    }
    
    // Also add cancel request for sent requests
    const handleCancelRequest = async (request: FriendshipWithProfile) => {
        setActionLoadingId(request.id)
        
        // Optimistic UI
        setSentRequests(prev => prev.filter(r => r.id !== request.id))
        setSuggestedFriends(prev => [request.profile, ...prev]) // put them back in suggestions
        
        // Note: removeFriend works for deleting pending requests you sent, as it matches requester_id
        const result = await removeFriend(request.id)
        if (result.success) {
            toast.success('Request cancelled')
        } else {
            // Revert
            setSuggestedFriends(prev => prev.filter(p => p.id !== request.profile.id))
            setSentRequests(prev => [request, ...prev])
            toast.error(result.error || 'Failed to cancel request')
        }
        setActionLoadingId(null)
    }

    // ─── Avatar helper ───
    const AvatarCircle = ({ url, name, size = 'md' }: { url?: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) => {
        const dim = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12'
        const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'
        return url ? (
            <img src={url} alt={name} className={`${dim} rounded-full object-cover ring-2 ring-slate-100 dark:ring-white/10`} />
        ) : (
            <div className={`${dim} bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white ring-2 ring-slate-100 dark:ring-white/10`}>
                <span className={`${textSize} font-black italic font-[family-name:var(--font-display)]`}>
                    {name ? name.charAt(0).toUpperCase() : '?'}
                </span>
            </div>
        )
    }

    // Filtered lists for the friend search — applied within whichever sub-view is active
    const friendQuery = friendSearchQuery.trim().toLowerCase()
    const filteredFriends = friendQuery ? friends.filter(f => f.profile.username.toLowerCase().includes(friendQuery)) : friends
    const filteredPendingRequests = friendQuery ? pendingRequests.filter(r => r.profile.username.toLowerCase().includes(friendQuery)) : pendingRequests
    const filteredSuggestedFriends = friendQuery ? suggestedFriends.filter(p => p.username.toLowerCase().includes(friendQuery)) : suggestedFriends
    const filteredSentRequests = friendQuery ? sentRequests.filter(r => r.profile.username.toLowerCase().includes(friendQuery)) : sentRequests

    return (
        <div className={`${display.variable} ${body.variable} min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24 font-[family-name:var(--font-body)]`}>
            {/* Cover Photo Banner */}
            <div className="h-40 relative bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 overflow-hidden">
                {coverUrl && (
                    <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-[#F8F9FD] dark:to-[#0f0a1e]" />

                {isCoverUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm z-10">
                        <Loader2 className="w-7 h-7 text-white animate-spin" />
                    </div>
                )}

                <div className="absolute top-0 left-0 right-0 px-4 py-4 flex items-center justify-between z-10">
                    <Link href="/dashboard" className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-colors group">
                        <ArrowLeft size={20} className="text-white group-hover:-translate-x-1 transition-transform" />
                    </Link>

                    <label className="flex items-center gap-1.5 px-3 py-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-colors cursor-pointer text-white text-xs font-bold">
                        <Camera size={14} />
                        Edit cover
                        <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleCoverUpload}
                            disabled={isCoverUploading}
                        />
                    </label>
                </div>
            </div>

            <main className="max-w-2xl mx-auto px-0 sm:px-4 -mt-16 relative z-10 space-y-6">
                {/* Profile Card (Social Media Style, left-aligned) */}
                <div className="bg-white dark:bg-[#1a1429]/80 dark:backdrop-blur-xl sm:rounded-3xl shadow-sm border-b sm:border border-slate-200 dark:border-white/10 pt-4 pb-6 px-6">

                    {/* Top row: avatar overlaps the cover on the left, actions sit top-right */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="relative group flex-shrink-0 -mt-12 sm:-mt-14">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-xl ring-4 ring-white dark:ring-[#1a1429] overflow-hidden">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={displayUsername} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl sm:text-4xl font-black italic font-[family-name:var(--font-display)]">
                                        {displayUsername ? displayUsername.charAt(0).toUpperCase() : "?"}
                                    </span>
                                )}

                                {isAvatarUploading && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    </div>
                                )}
                            </div>

                            <label className="absolute bottom-0 right-0 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-110 active:scale-95 transition-all text-slate-600 dark:text-white">
                                <Camera size={16} />
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    disabled={isAvatarUploading}
                                />
                            </label>
                        </div>

                        {/* Action Buttons */}
                        {!isEditing && (
                            <div className="flex items-center gap-2 pt-3 shrink-0">
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                >
                                    Edit Profile
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-2"
                                >
                                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    {copied ? 'Copied' : 'Share'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Info block — always left-aligned */}
                    <div className="mt-3 text-left">
                        <div className="flex items-center gap-1.5">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-[family-name:var(--font-display)]">
                                {displayUsername}
                            </h2>
                            {profile.is_pro ? (
                                <VerifiedBadge size={22} />
                            ) : (
                                <Link href="/upgrade" className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-500 hover:text-blue-600 transition bg-blue-500/10 px-2 py-0.5 rounded-full">
                                    <BadgeCheck size={12} /> Get Verified
                                </Link>
                            )}
                        </div>
                        <p className="text-[15px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            @{displaySlug}
                        </p>

                        {/* Bio Display */}
                        {!isEditing && (
                            <div className="mt-3 text-sm text-slate-700 dark:text-slate-300 max-w-md whitespace-pre-wrap">
                                {displayBio ? displayBio : (
                                    <span className="text-slate-400 dark:text-slate-500 italic">No bio added yet.</span>
                                )}
                            </div>
                        )}

                            {/* Editing Form */}
                            {isEditing && (
                                <motion.form 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    action={clientAction} 
                                    className="w-full space-y-4 mt-6 text-left"
                                >
                                    <div>
                                        <label htmlFor="username" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Name</label>
                                        <input
                                            type="text"
                                            name="username"
                                            id="username"
                                            defaultValue={profile.username}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white font-bold transition-all"
                                            placeholder="Your name"
                                            minLength={2}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="slug" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Username</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500 font-bold select-none">@</span>
                                            <input
                                                type="text"
                                                name="slug"
                                                id="slug"
                                                value={slug}
                                                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                                                className={`w-full pl-9 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border focus:outline-none focus:ring-2 text-slate-900 dark:text-white font-bold transition-all ${slugAvailable === false
                                                    ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500'
                                                    : slugAvailable === true
                                                        ? 'border-green-300 dark:border-green-500/50 focus:ring-green-500'
                                                        : 'border-slate-200 dark:border-slate-800 focus:ring-purple-500'
                                                    }`}
                                                placeholder="username"
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
                                                This forms your unique profile link.
                                            </p>
                                            {slugMessage && (
                                                <p className={`text-[10px] font-bold ${slugAvailable === true ? 'text-green-500' : slugAvailable === false ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {slugMessage}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="bio" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Bio</label>
                                        <textarea
                                            name="bio"
                                            id="bio"
                                            value={bioInput}
                                            onChange={(e) => setBioInput(e.target.value)}
                                            rows={3}
                                            maxLength={160}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white font-medium transition-all resize-none"
                                            placeholder="Write a little bit about yourself..."
                                        />
                                        <p className="text-[10px] text-slate-400 text-right mt-1">{bioInput.length} / 160</p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Disable DMs</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Block new direct messages.</p>
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
                                            className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="flex-1 py-3 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700 transition flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                            Save Profile
                                        </button>
                                    </div>
                                    <input type="hidden" name="avatar_url" value={avatarUrl || ''} />
                                    <input type="hidden" name="cover_url" value={coverUrl || ''} />
                                </motion.form>
                            )}
                        </div>

                    {/* Stats Row */}
                    {!isEditing && (
                        <div className="flex items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/60">
                            <div className="flex justify-start gap-8">
                                <div className="text-left cursor-pointer" onClick={() => { setActiveTab('friends'); setIsFriendsSectionOpen(true) }}>
                                    <p className="text-xl font-black text-slate-900 dark:text-white">{friends.length}</p>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Friends</p>
                                </div>
                                <div className="text-left cursor-pointer" onClick={() => { setActiveTab('requests'); setIsFriendsSectionOpen(true) }}>
                                    <p className="text-xl font-black text-slate-900 dark:text-white">{pendingRequests.length}</p>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Requests</p>
                                </div>
                                <div className="text-left hidden sm:block">
                                    <p className="text-xl font-black text-slate-900 dark:text-white">{profile.is_pro ? 'PRO' : 'Free'}</p>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                                </div>
                            </div>
                            <XPBalance />
                        </div>
                    )}

                    {/* Friends Section — lives in the same card now, just divided by a hairline */}
                    <div className="border-t border-slate-100 dark:border-slate-800/60 -mx-6 px-6 mt-2">

                        <div className="pt-4 pb-4 space-y-4">

                                {/* Sub-view dropdown + search — replaces the old pill tab row */}
                                <div className="flex items-center gap-2">
                                    <div className="relative w-36 sm:w-44 shrink-0">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsFriendsDropdownOpen(!isFriendsDropdownOpen) }}
                                            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <span className="flex items-center gap-2 min-w-0 truncate">
                                                {(() => {
                                                    const current = [
                                                        { id: 'friends', label: 'Friends', count: friends.length, icon: Users },
                                                        { id: 'requests', label: 'Requests', count: pendingRequests.length, icon: Clock },
                                                        { id: 'suggestions', label: 'Suggested', count: suggestedFriends.length, icon: UserPlus },
                                                        { id: 'sent', label: 'Sent', count: sentRequests.length, icon: Send },
                                                    ].find(t => t.id === activeTab)!
                                                    return (
                                                        <>
                                                            <current.icon size={16} className="shrink-0" />
                                                            <span className="truncate">{current.label}</span>
                                                            {current.count > 0 && (
                                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                                                                    {current.count}
                                                                </span>
                                                            )}
                                                        </>
                                                    )
                                                })()}
                                            </span>
                                            <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${isFriendsDropdownOpen ? "rotate-180" : ""}`} />
                                        </button>

                                        {isFriendsDropdownOpen && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#1a1429] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                                                {[
                                                    { id: 'friends', label: 'Friends', count: friends.length, icon: Users },
                                                    { id: 'requests', label: 'Requests', count: pendingRequests.length, icon: Clock },
                                                    { id: 'suggestions', label: 'Suggested', count: suggestedFriends.length, icon: UserPlus },
                                                    { id: 'sent', label: 'Sent', count: sentRequests.length, icon: Send },
                                                ].map((tab) => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => { setActiveTab(tab.id as any); setIsFriendsDropdownOpen(false) }}
                                                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                                                            activeTab === tab.id
                                                            ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300'
                                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <tab.icon size={16} />
                                                        {tab.label}
                                                        {tab.count > 0 && (
                                                            <span className="ml-auto px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                                {tab.count}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Friend search */}
                                    <div className="flex items-center">
                                        {isFriendSearchOpen && (
                                            <input
                                                type="text"
                                                autoFocus
                                                value={friendSearchQuery}
                                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                                placeholder="Search..."
                                                className="w-28 sm:w-40 mr-1.5 px-3 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 animate-in fade-in slide-in-from-right-2 duration-200"
                                            />
                                        )}
                                        <button
                                            onClick={() => {
                                                if (isFriendSearchOpen) {
                                                    setFriendSearchQuery('')
                                                    setIsFriendSearchOpen(false)
                                                } else {
                                                    setIsFriendSearchOpen(true)
                                                }
                                            }}
                                            aria-label={isFriendSearchOpen ? "Close search" : "Search friends"}
                                            className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            {isFriendSearchOpen ? <X size={16} /> : <Search size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Tab Content */}
                                <div className="bg-slate-50/60 dark:bg-black/10 rounded-2xl overflow-hidden">

                        {/* Friends Tab */}
                        {activeTab === 'friends' && (
                            <div className="p-2 sm:p-4">
                                {friends.length === 0 ? (
                                    <div className="flex flex-col items-center py-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                            <Users size={28} className="text-slate-300 dark:text-slate-500" />
                                        </div>
                                        <p className="text-base font-bold text-slate-900 dark:text-white mb-1">No friends yet</p>
                                        <p className="text-sm text-slate-500 mb-4">Add some friends to play games with!</p>
                                        <button onClick={() => setActiveTab('suggestions')} className="px-4 py-2 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 rounded-lg text-sm font-bold">
                                            Find Friends
                                        </button>
                                    </div>
                                ) : filteredFriends.length === 0 ? (
                                    <div className="flex flex-col items-center py-10 text-center">
                                        <Search size={22} className="text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No friends match "{friendSearchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {filteredFriends.map(f => (
                                            <div key={f.id} className="flex items-center gap-3 p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors rounded-xl">
                                                <Link href={`/u/${f.profile.slug || f.profile.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                                                    <AvatarCircle url={f.profile.avatar_url} name={f.profile.username} size="lg" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-base text-slate-900 dark:text-white truncate">
                                                            {f.profile.username}
                                                        </p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                                            @{f.profile.slug || f.profile.username}
                                                        </p>
                                                    </div>
                                                </Link>
                                                <button
                                                    onClick={() => router.push(`/messages/${f.profile.slug || f.profile.username}`)}
                                                    className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-bold rounded-xl text-sm border border-slate-200 transition-colors flex items-center justify-center flex-shrink-0"
                                                >
                                                    Message
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Requests Tab */}
                        {activeTab === 'requests' && (
                            <div className="p-2 sm:p-4">
                                {pendingRequests.length === 0 ? (
                                    <div className="flex flex-col items-center py-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                            <Clock size={28} className="text-slate-300 dark:text-slate-500" />
                                        </div>
                                        <p className="text-base font-bold text-slate-900 dark:text-white mb-1">No pending requests</p>
                                        <p className="text-sm text-slate-500">You're all caught up!</p>
                                    </div>
                                ) : filteredPendingRequests.length === 0 ? (
                                    <div className="flex flex-col items-center py-10 text-center">
                                        <Search size={22} className="text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No requests match "{friendSearchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {filteredPendingRequests.map(req => (
                                            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors rounded-xl">
                                                <Link href={`/u/${req.profile.slug || req.profile.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                                                    <AvatarCircle url={req.profile.avatar_url} name={req.profile.username} size="lg" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-base text-slate-900 dark:text-white truncate">
                                                            {req.profile.username}
                                                        </p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                                            Wants to connect
                                                        </p>
                                                    </div>
                                                </Link>
                                                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                                    <button
                                                        onClick={() => handleAcceptRequest(req)}
                                                        disabled={actionLoadingId === req.id}
                                                        className="flex-1 sm:flex-none px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {actionLoadingId === req.id ? <Loader2 size={16} className="animate-spin" /> : "Confirm"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeclineRequest(req)}
                                                        disabled={actionLoadingId === req.id}
                                                        className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Suggestions Tab */}
                        {activeTab === 'suggestions' && (
                            <div className="p-2 sm:p-4">
                                {suggestedFriends.length === 0 ? (
                                    <div className="flex flex-col items-center py-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                            <UserPlus size={28} className="text-slate-300 dark:text-slate-500" />
                                        </div>
                                        <p className="text-base font-bold text-slate-900 dark:text-white mb-1">No suggestions right now</p>
                                        <p className="text-sm text-slate-500">Share your profile link to invite friends!</p>
                                    </div>
                                ) : filteredSuggestedFriends.length === 0 ? (
                                    <div className="flex flex-col items-center py-10 text-center">
                                        <Search size={22} className="text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No suggestions match "{friendSearchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {filteredSuggestedFriends.map(person => (
                                            <div key={person.id} className="flex items-center gap-3 p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors rounded-xl">
                                                <Link href={`/u/${person.slug || person.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                                                    <AvatarCircle url={person.avatar_url} name={person.username} size="lg" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-base text-slate-900 dark:text-white truncate">
                                                            {person.username}
                                                        </p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                                            Suggested for you
                                                        </p>
                                                    </div>
                                                </Link>
                                                <button
                                                    onClick={() => handleSendRequest(person)}
                                                    disabled={actionLoadingId === person.id}
                                                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0"
                                                >
                                                    {actionLoadingId === person.id ? <Loader2 size={16} className="animate-spin" /> : <>Add<span className="hidden sm:inline"> Friend</span></>}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sent Requests Tab */}
                        {activeTab === 'sent' && (
                            <div className="p-2 sm:p-4">
                                {sentRequests.length === 0 ? (
                                    <div className="flex flex-col items-center py-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                            <Send size={28} className="text-slate-300 dark:text-slate-500" />
                                        </div>
                                        <p className="text-base font-bold text-slate-900 dark:text-white mb-1">No sent requests</p>
                                        <p className="text-sm text-slate-500">Requests you send will appear here.</p>
                                    </div>
                                ) : filteredSentRequests.length === 0 ? (
                                    <div className="flex flex-col items-center py-10 text-center">
                                        <Search size={22} className="text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No sent requests match "{friendSearchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {filteredSentRequests.map(req => (
                                            <div key={req.id} className="flex items-center gap-3 p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors rounded-xl">
                                                <Link href={`/u/${req.profile.slug || req.profile.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                                                    <AvatarCircle url={req.profile.avatar_url} name={req.profile.username} size="lg" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-base text-slate-900 dark:text-white truncate">
                                                            {req.profile.username}
                                                        </p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                                            Request sent
                                                        </p>
                                                    </div>
                                                </Link>
                                                <button
                                                    onClick={() => handleCancelRequest(req)}
                                                    disabled={actionLoadingId === req.id || req.id.startsWith('temp')}
                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50 text-sm flex-shrink-0"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                                </div>
                            </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
