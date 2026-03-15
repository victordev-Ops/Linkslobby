'use client'

import { useState } from 'react'
import { ArrowLeft, MessageSquare, Star, Calendar, UserPlus, Loader2, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import VerifiedBadge from '@/components/VerifiedBadge'
import { sendFriendRequest } from '@/actions/friends'
import { toast } from 'sonner'

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
}

export default function PublicProfileClient({ profile }: PublicProfileClientProps) {
    const router = useRouter()
    const [isSendingRequest, setIsSendingRequest] = useState(false)
    const [requestSent, setRequestSent] = useState(false)

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
                    <div className="flex items-center gap-1.5">
                        {profile.is_pro && <VerifiedBadge size={20} />}
                        <h1 className="text-2xl font-black">@{profile.username}</h1>
                    </div>
                    {joinDate && (
                        <div className="flex items-center gap-1.5 text-white/40 text-sm">
                            <Calendar size={14} />
                            <span>Joined {joinDate}</span>
                        </div>
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
                    <button
                        onClick={handleAddFriend}
                        disabled={isSendingRequest || requestSent}
                        className={`px-5 py-3.5 border font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-60 ${
                            requestSent
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                        }`}
                    >
                        {isSendingRequest ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : requestSent ? (
                            <Check size={18} />
                        ) : (
                            <UserPlus size={18} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
