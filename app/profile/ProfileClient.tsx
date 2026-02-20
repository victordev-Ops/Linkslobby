'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Copy, Check, Loader2, User as UserIcon, XCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { updateProfile, checkSlugAvailability } from '@/actions/profile'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'

interface ProfileClientProps {
    user: any
    profile: {
        username: string
        slug: string
        email: string
    }
}

export default function ProfileClient({ user, profile }: ProfileClientProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Local state for optimistic updates
    const [displayUsername, setDisplayUsername] = useState(profile.username)
    const [displaySlug, setDisplaySlug] = useState(profile.slug)

    // Slug check states
    const [slug, setSlug] = useState(profile.slug)
    const debouncedSlug = useDebounce(slug, 500)
    const [isSlugChecking, setIsSlugChecking] = useState(false)
    const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
    const [slugMessage, setSlugMessage] = useState('')

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
            if (newUsername) setDisplayUsername(newUsername)
            if (newSlug) setDisplaySlug(newSlug)

            toast.success(result.success)
            setIsEditing(false)
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">
            {/* Header */}
            <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                    </Link>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Profile</h1>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 transition"
                    >
                        Edit Profile
                    </button>
                )}
            </div>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
                {/* Profile Card */}
                <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-white/10 p-8 flex flex-col items-center">
                    <div className="w-24 h-24 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg mb-4 ring-4 ring-white dark:ring-[#1a1429]">
                        <span className="text-3xl font-black italic">
                            {displayUsername ? displayUsername.charAt(0).toUpperCase() : "?"}
                        </span>
                    </div>

                    {!isEditing ? (
                        <>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">
                                @{displayUsername}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-center mt-1 mb-6">
                                {displaySlug}
                            </p>

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
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-bold transition-all"
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
                                        className={`w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-50 dark:bg-black/20 border focus:outline-none focus:ring-2 font-bold transition-all ${slugAvailable === false
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
            </main>
        </div>
    )
}
