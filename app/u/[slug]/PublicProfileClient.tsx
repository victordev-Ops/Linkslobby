'use client'

import { useState, useRef, useEffect } from 'react'
import { Space_Grotesk, Inter } from 'next/font/google'
import {
    ArrowLeft, MessageSquare, Calendar, UserPlus, Loader2, Check, X, Camera,
    Zap, MoreVertical, UserMinus, Ban, ShieldOff, Send, UserX
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import VerifiedBadge from '@/components/VerifiedBadge'
import {
    sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
    blockUser, unblockUser
} from '@/actions/friends'
import { updateBio, updateProfile } from '@/actions/profile'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import { FileText, BadgeCheck } from 'lucide-react'

// Same two-role type system as the dashboard/profile pages: Space Grotesk
// for headings, Inter for body copy. Ideally these live in app/layout.tsx
// so Next can inject the CSS vars globally — kept here so this file works
// standalone.
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

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

interface PublicProfileClientProps {
    profile: {
        id: string
        username: string
        slug: string
        avatar_url?: string | null
        cover_url?: string | null
        is_pro?: boolean
        xp_balance?: number
        created_at?: string
    }
    isOwnProfile?: boolean
    initialBio?: string
    friendshipStatus?: FriendshipStatus
    friendshipId?: string
    viewerIsPro?: boolean
    isBlockedByViewer?: boolean
}

export default function PublicProfileClient({
    profile,
    isOwnProfile = false,
    initialBio = '',
    friendshipStatus = 'none',
    friendshipId,
    viewerIsPro = false,
    isBlockedByViewer = false
}: PublicProfileClientProps) {
    const router = useRouter()
    const supabaseClient = createClient()

    const [status, setStatus] = useState<FriendshipStatus>(friendshipStatus)
    const [activeFriendshipId, setActiveFriendshipId] = useState<string | undefined>(friendshipId)
    const [isProcessingFriend, setIsProcessingFriend] = useState(false)
    const [isBlocked, setIsBlocked] = useState(isBlockedByViewer)
    const [friendMenuOpen, setFriendMenuOpen] = useState(false)
    const friendMenuRef = useRef<HTMLDivElement>(null)

    const [bio, setBio] = useState(initialBio)
    const [isSavingBio, setIsSavingBio] = useState(false)

    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null)
    const [coverUrl, setCoverUrl] = useState(profile.cover_url || null)
    const [isAvatarUploading, setIsAvatarUploading] = useState(false)
    const [isCoverUploading, setIsCoverUploading] = useState(false)

    const joinDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })
        : null

    // ─── Friend request handlers ───
    const handleAddFriend = async () => {
        setIsProcessingFriend(true)
        try {
            const result = await sendFriendRequest(profile.id)
            if (result.success) {
                setStatus('pending_sent')
                toast.success('Friend request sent!')
            } else {
                toast.error(result.error || 'Failed to send request')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsProcessingFriend(false)
        }
    }

    const handleAccept = async () => {
        if (!activeFriendshipId) return
        setIsProcessingFriend(true)
        try {
            const result = await acceptFriendRequest(activeFriendshipId)
            if (result.success) {
                setStatus('accepted')
                toast.success(`You and ${profile.username} are now friends!`)
            } else {
                toast.error(result.error || 'Failed to accept request')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsProcessingFriend(false)
        }
    }

    const handleDecline = async () => {
        if (!activeFriendshipId) return
        setIsProcessingFriend(true)
        try {
            const result = await declineFriendRequest(activeFriendshipId)
            if (result.success) {
                setStatus('none')
                setActiveFriendshipId(undefined)
                toast.success('Request declined')
            } else {
                toast.error(result.error || 'Failed to decline request')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsProcessingFriend(false)
        }
    }

    const handleCancelRequest = async () => {
        if (!activeFriendshipId) return
        setIsProcessingFriend(true)
        setFriendMenuOpen(false)
        try {
            const result = await removeFriend(activeFriendshipId)
            if (result.success) {
                setStatus('none')
                setActiveFriendshipId(undefined)
                toast.success('Request cancelled')
            } else {
                toast.error(result.error || 'Failed to cancel request')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsProcessingFriend(false)
        }
    }

    const handleUnfriend = async () => {
        if (!activeFriendshipId) return
        setIsProcessingFriend(true)
        setFriendMenuOpen(false)
        try {
            const result = await removeFriend(activeFriendshipId)
            if (result.success) {
                setStatus('none')
                setActiveFriendshipId(undefined)
                toast.success(`Removed ${profile.username} as a friend`)
            } else {
                toast.error(result.error || 'Failed to remove friend')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsProcessingFriend(false)
        }
    }

    const handleBlock = async () => {
        setIsProcessingFriend(true)
        setFriendMenuOpen(false)
        try {
            const result = await blockUser(profile.id)
            if (result.success) {
                setIsBlocked(true)
                setStatus('none')
                setActiveFriendshipId(undefined)
                toast.success(`${profile.username} has been blocked`)
            } else {
                toast.error(result.error || 'Failed to block user')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsProcessingFriend(false)
        }
    }

    const handleUnblock = async () => {
        setIsProcessingFriend(true)
        setFriendMenuOpen(false)
        try {
            const result = await unblockUser(profile.id)
            if (result.success) {
                setIsBlocked(false)
                toast.success(`${profile.username} has been unblocked`)
            } else {
                toast.error(result.error || 'Failed to unblock user')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsProcessingFriend(false)
        }
    }

    // Close the friend actions dropdown when clicking outside it
    useEffect(() => {
        if (!friendMenuOpen) return
        const handleClickOutside = (e: MouseEvent) => {
            if (friendMenuRef.current && !friendMenuRef.current.contains(e.target as Node)) {
                setFriendMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [friendMenuOpen])

    // ─── Image upload handlers (own profile only) ───
    const uploadImage = async (file: File, bucket: 'avatars' | 'covers') => {
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image size must be less than 2MB')
            return null
        }
        const fileExt = file.name.split('.').pop()
        const fileName = `${profile.id}-${Math.random()}.${fileExt}`
        const filePath = `${bucket}/${fileName}`

        const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(filePath, file)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabaseClient.storage.from(bucket).getPublicUrl(filePath)
        return publicUrl
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsAvatarUploading(true)
        try {
            const publicUrl = await uploadImage(file, 'avatars')
            if (!publicUrl) return
            const formData = new FormData()
            formData.append('username', profile.username)
            formData.append('slug', profile.slug)
            formData.append('avatar_url', publicUrl)
            formData.append('scope', 'image')
            const result = await updateProfile(null, formData)
            if (result.error) throw new Error(result.error)
            setAvatarUrl(publicUrl)
            router.refresh()
        } catch (error: any) {
            console.error('Avatar upload error:', error)
            toast.error(error.message || 'Failed to upload image')
        } finally {
            setIsAvatarUploading(false)
        }
    }

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsCoverUploading(true)
        try {
            const publicUrl = await uploadImage(file, 'covers')
            if (!publicUrl) return
            const formData = new FormData()
            formData.append('username', profile.username)
            formData.append('slug', profile.slug)
            formData.append('cover_url', publicUrl)
            formData.append('scope', 'image')
            const result = await updateProfile(null, formData)
            if (result.error) throw new Error(result.error)
            setCoverUrl(publicUrl)
            router.refresh()
        } catch (error: any) {
            console.error('Cover upload error:', error)
            toast.error(error.message || 'Failed to upload cover photo')
        } finally {
            setIsCoverUploading(false)
        }
    }

    return (
        <div className={`${display.variable} ${body.variable} min-h-screen bg-black text-white font-[family-name:var(--font-body)]`}>
            {/* Cover Photo */}
            <div className="h-44 sm:h-56 relative bg-gradient-to-br from-neutral-900 via-neutral-950 to-black overflow-hidden">
                {coverUrl && (
                    <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/40" />

                {isCoverUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm z-10">
                        <Loader2 className="w-7 h-7 text-white animate-spin" />
                    </div>
                )}

                <button
                    onClick={() => router.back()}
                    className="absolute top-4 left-4 p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-black/60 transition z-10"
                >
                    <ArrowLeft size={20} />
                </button>

                {isOwnProfile && (
                    <label className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-black/60 transition z-10 cursor-pointer text-xs font-bold">
                        <Camera size={14} />
                        Edit cover
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleCoverUpload}
                            disabled={isCoverUploading}
                        />
                    </label>
                )}
            </div>

            {/* Profile Section */}
            <div className="max-w-lg mx-auto px-4 -mt-14 relative z-10">
                {/* Avatar */}
                <div className="flex items-end justify-between mb-4">
                    <div className="relative">
                        <div className="w-28 h-28 rounded-full ring-4 ring-black overflow-hidden bg-neutral-800 flex items-center justify-center text-white shadow-xl">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-black italic font-[family-name:var(--font-display)]">
                                    {profile.username?.[0]?.toUpperCase() || '?'}
                                </span>
                            )}
                            {isAvatarUploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                                </div>
                            )}
                        </div>

                        {isOwnProfile && (
                            <label className="absolute bottom-0 right-0 p-2 bg-white text-black rounded-full shadow-lg border-2 border-black cursor-pointer hover:scale-110 active:scale-95 transition-all">
                                <Camera size={16} />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                    disabled={isAvatarUploading}
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* Name, Handle & Badge */}
                <div className="mb-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <h1 className="text-2xl font-black tracking-tight font-[family-name:var(--font-display)] truncate">{profile.username}</h1>
                            {profile.is_pro ? (
                                <VerifiedBadge size={20} />
                            ) : isOwnProfile && (
                                <Link href="/upgrade" className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:text-white/80 transition bg-white/10 border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                                    <BadgeCheck size={12} /> Get Verified
                                </Link>
                            )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1 bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
                            <Zap size={11} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-xs font-bold text-white">
                                {(profile.xp_balance ?? 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <p className="text-[15px] text-white/50 font-medium mt-0.5">
                        @{profile.slug}
                    </p>
                    {joinDate && (
                        <div className="flex items-center gap-1.5 text-white/40 text-sm mt-2">
                            <Calendar size={14} />
                            <span>Joined {joinDate}</span>
                        </div>
                    )}
                </div>

                {/* Bio Section */}
                <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText size={14} className="text-white/40" />
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                            {isOwnProfile ? 'In My Own Words' : `In ${profile.username}'s Own Words`}
                        </p>
                    </div>
                    {isOwnProfile ? (
                        <>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value.slice(0, 160))}
                                placeholder="Write a short bio..."
                                maxLength={160}
                                rows={2}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-all resize-none"
                            />
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-[10px] text-white/40">{bio.length}/160</p>
                                <button
                                    onClick={async () => {
                                        setIsSavingBio(true)
                                        try {
                                            const result = await updateBio(bio)
                                            if (result.success) toast.success('Bio updated!')
                                            else toast.error(result.error || 'Failed to update bio')
                                        } catch {
                                            toast.error('Something went wrong')
                                        } finally {
                                            setIsSavingBio(false)
                                        }
                                    }}
                                    disabled={isSavingBio || bio === initialBio}
                                    className="px-4 py-1.5 bg-white hover:bg-white/90 text-black rounded-lg font-bold text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isSavingBio ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                    Save
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-white/80 whitespace-pre-wrap">
                            {bio || <span className="text-white/30 italic">No bio written yet.</span>}
                        </p>
                    )}
                </div>

                {/* Actions */}
                {!isOwnProfile && (
                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={() => router.push(`/messages/${profile.id}`)}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white hover:bg-white/90 text-black font-bold rounded-2xl transition-all active:scale-95"
                        >
                            <MessageSquare size={18} />
                            Message
                        </button>

                        {isBlocked ? (
                            <button
                                onClick={handleUnblock}
                                disabled={isProcessingFriend}
                                className="px-5 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2 justify-center"
                            >
                                {isProcessingFriend ? <Loader2 size={18} className="animate-spin" /> : <ShieldOff size={18} />}
                                Unblock
                            </button>
                        ) : (
                            <>
                                {status === 'pending_received' ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAccept}
                                            disabled={isProcessingFriend}
                                            className="px-5 py-3.5 bg-white hover:bg-white/90 text-black font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2 justify-center"
                                            title="Accept request"
                                        >
                                            {isProcessingFriend ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                        </button>
                                        <button
                                            onClick={handleDecline}
                                            disabled={isProcessingFriend}
                                            className="px-5 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2 justify-center"
                                            title="Decline request"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={status === 'accepted' ? undefined : handleAddFriend}
                                        disabled={isProcessingFriend || status === 'pending_sent' || status === 'accepted'}
                                        className={`px-5 py-3.5 border font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2 justify-center ${
                                            status === 'accepted'
                                                ? 'bg-white/10 border-white/20 text-white cursor-default'
                                                : status === 'pending_sent'
                                                    ? 'bg-white/5 border-white/10 text-white/50'
                                                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                                        }`}
                                    >
                                        {isProcessingFriend ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : status === 'pending_sent' ? (
                                            <><Check size={18} /> Sent</>
                                        ) : status === 'accepted' ? (
                                            'Friends'
                                        ) : (
                                            <><UserPlus size={18} /> Add</>
                                        )}
                                    </button>
                                )}

                                {/* Three-dot menu — all friend actions live here */}
                                <div className="relative" ref={friendMenuRef}>
                                    <button
                                        onClick={() => setFriendMenuOpen(v => !v)}
                                        disabled={isProcessingFriend}
                                        className="h-full px-3 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center"
                                        title="More friend actions"
                                        aria-label="More friend actions"
                                    >
                                        <MoreVertical size={18} />
                                    </button>

                                    {friendMenuOpen && (
                                        <div className="absolute right-0 bottom-full mb-2 w-52 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 py-1">
                                            {status === 'none' && (
                                                <button
                                                    onClick={() => { setFriendMenuOpen(false); handleAddFriend() }}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                                >
                                                    <Send size={15} /> Send friend request
                                                </button>
                                            )}
                                            {status === 'pending_sent' && (
                                                <button
                                                    onClick={handleCancelRequest}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                                >
                                                    <UserX size={15} /> Cancel request
                                                </button>
                                            )}
                                            {status === 'pending_received' && (
                                                <>
                                                    <button
                                                        onClick={() => { setFriendMenuOpen(false); handleAccept() }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                                    >
                                                        <Check size={15} /> Accept request
                                                    </button>
                                                    <button
                                                        onClick={() => { setFriendMenuOpen(false); handleDecline() }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                                    >
                                                        <X size={15} /> Decline request
                                                    </button>
                                                </>
                                            )}
                                            {status === 'accepted' && (
                                                <button
                                                    onClick={handleUnfriend}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                                >
                                                    <UserMinus size={15} /> Unfriend
                                                </button>
                                            )}
                                            <button
                                                onClick={handleBlock}
                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                <Ban size={15} /> Block user
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
