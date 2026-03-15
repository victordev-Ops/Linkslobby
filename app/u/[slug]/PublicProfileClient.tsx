'use client'

import { useState } from 'react'
import { ArrowLeft, MessageSquare, Star, Calendar, UserPlus, Loader2, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import VerifiedBadge from '@/components/VerifiedBadge'
import { sendFriendRequest } from '@/actions/friends'
import { updateBio } from '@/actions/profile'
import { toast } from 'sonner'
import Link from 'next/link'
import { FileText, BadgeCheck } from 'lucide-react'

interface PublicProfileClientProps {
    profile: {
        id: string
        username: string
        slug: string
        avatar_url?: string | null
        is_pro?: boolean
        xp_balance?: number
        created_at?: string
    }
    isOwnProfile?: boolean
    initialBio?: string
    friendshipStatus?: 'none' | 'pending' | 'accepted'
    viewerIsPro?: boolean
}

export default function PublicProfileClient({ 
    profile, 
    isOwnProfile = false,
    initialBio = '',
    friendshipStatus = 'none',
    viewerIsPro = false
}: PublicProfileClientProps) {
    const router = useRouter()
    const [isSendingRequest, setIsSendingRequest] = useState(false)
    const [requestSent, setRequestSent] = useState(friendshipStatus === 'pending')
    const [bio, setBio] = useState(initialBio)
    const [isSavingBio, setIsSavingBio] = useState(false)

    const joinDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })
        : null

    const handleAddFriend = async () => {
        setIsSendingRequest(true)
        try {
            const result = await sendFriendRequest(profile.id)
            if (result.success) {
                setRequestSent(true)
                toast.success('Friend request sent!')
            } else {
                toast.error(result.error || 'Failed to send request')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsSendingRequest(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0f0a1e] text-white">
            {/* Gradient Cover */}
            <div className="h-36 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 relative">
                <button
                    onClick={() => router.back()}
                    className="absolute top-4 left-4 p-2 bg-black/30 backdrop-blur-sm rounded-full hover:bg-black/50 transition z-10"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>

            {/* Profile Section */}
            <div className="max-w-lg mx-auto px-4 -mt-16 relative z-10">
                {/* Avatar */}
                <div className="flex items-end gap-4 mb-4">
                    <div className="w-28 h-28 rounded-full ring-4 ring-[#0f0a1e] overflow-hidden bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-xl">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-black italic">
                                {profile.username?.[0]?.toUpperCase() || '?'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Name & Badge */}
                <div className="space-y-1 mb-6">
                    <div className="flex flex-col gap-1 items-start">
                        {!viewerIsPro && (
                            <Link href="/upgrade" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition bg-blue-500/10 px-2 py-1 rounded-full mb-1">
                            <BadgeCheck size={14} /> Get Verified
                            </Link>
                        )}
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-2xl font-black">@{profile.username}</h1>
                            {profile.is_pro && <VerifiedBadge size={20} />}
                        </div>
                    </div>
                    {joinDate && (
                        <div className="flex items-center gap-1.5 text-white/40 text-sm">
                            <Calendar size={14} />
                            <span>Joined {joinDate}</span>
                        </div>
                    )}
                </div>

                {/* Bio Section */}
                <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText size={14} className="text-white/40" />
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Bio</p>
                    </div>
                    {isOwnProfile ? (
                        <>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value.slice(0, 160))}
                                placeholder="Write a short bio..."
                                maxLength={160}
                                rows={2}
                                className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-purple-400/40 transition-all resize-none"
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
                                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
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

                {/* Stats */}
                <div className="flex gap-4 mb-8">
                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Star size={16} className="text-amber-400" />
                        </div>
                        <p className="text-2xl font-black text-white">{profile.xp_balance || 0}</p>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Stars</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push(`/messages/${profile.username}`)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-purple-900/30"
                    >
                        <MessageSquare size={18} />
                        Message
                    </button>
                    {!isOwnProfile && (
                        <button
                            onClick={friendshipStatus === 'accepted' ? undefined : handleAddFriend}
                            disabled={isSendingRequest || requestSent || friendshipStatus === 'accepted'}
                            className={`px-5 py-3.5 border font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2 justify-center ${
                                friendshipStatus === 'accepted'
                                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 cursor-default'
                                    : requestSent
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                            }`}
                        >
                            {isSendingRequest ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : requestSent ? (
                                <><Check size={18} /> Sent</>
                            ) : friendshipStatus === 'accepted' ? (
                                <><UserPlus size={18} /> Friends ✓</>
                            ) : (
                                <><UserPlus size={18} /> Add</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
