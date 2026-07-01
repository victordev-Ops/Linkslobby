import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Brain, Trophy, Sparkles } from 'lucide-react'
import DykmResultQuestions from './DykmResultQuestions'

export const dynamic = 'force-dynamic'

function getTier(score: number, total: number) {
    const pct = total > 0 ? score / total : 0
    if (pct === 1) return { label: 'Soulmate Status', emoji: '👑' }
    if (pct >= 0.7) return { label: 'Basically Besties', emoji: '🔥' }
    if (pct >= 0.4) return { label: 'Getting There', emoji: '🌱' }
    return { label: 'Total Stranger', emoji: '😅' }
}

export default async function DykmResultPage({ params }: { params: Promise<{ scoreId: string }> }) {
    const { scoreId } = await params
    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect(`/login?returnTo=/dykm/results/${scoreId}`)
    }

    // Fetch score details
    const { data: score } = await supabase
        .from('dykm_scores')
        .select('*')
        .eq('id', scoreId)
        .single()

    if (!score) {
        notFound()
    }

    // Determine if viewer is the owner
    const isOwner = score.quiz_owner_id === user.id

    // Fetch IsPro status
    const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', user.id)
        .single()
    const isPro = viewerProfile?.is_pro ?? false

    // Fetch revealed indices if owner
    let revealedIndices: number[] = []
    if (isOwner && !isPro) {
        const { data: reveals } = await supabase
            .from('dykm_response_reveals')
            .select('question_index')
            .eq('score_id', scoreId)
            .eq('viewer_id', user.id)

        if (reveals) {
            revealedIndices = reveals.map(r => r.question_index)
        }
    }

    const tier = getTier(score.score, score.total_questions)

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] text-slate-900 dark:text-white pb-20 transition-colors duration-300">
            {/* Header */}
            <div className="p-4 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-[#0f0a1e]/80 backdrop-blur-md z-10 border-b border-slate-100 dark:border-white/5">
                <Link href="/notifications" className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="font-bold text-lg">Quiz Result</h1>
            </div>

            <main className="max-w-md mx-auto px-6 py-10">
                <div className="flex flex-col items-center text-center">
                    <div className="inline-block px-3 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-6">
                        Do You Know Me?
                    </div>

                    <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-6 rotate-3">
                        <Brain className="w-10 h-10 text-white" />
                    </div>

                    <h2 className="text-2xl font-black mb-2 dark:text-white">
                        {isOwner ? `${(score as any).responder_name}'s Attempt` : 'Your Result'}
                    </h2>

                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                        {isOwner ? "Here's how they did guessing you:" : "Here's how you did:"}
                    </p>

                    <div className="w-full bg-white dark:bg-[#1a1429] rounded-3xl p-8 border border-slate-100 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />

                        <div className="flex flex-col items-center">
                            <div className={`px-4 py-1.5 bg-gradient-to-r ${score.score === score.total_questions ? 'from-amber-400 to-yellow-500' : 'from-indigo-500 to-purple-600'} text-white text-xs font-black uppercase tracking-wider rounded-full mb-4 flex items-center gap-1.5`}>
                                <span>{tier.emoji}</span> {tier.label}
                            </div>

                            <div className="flex items-baseline gap-1">
                                <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                                    {score.score}
                                </span>
                                <span className="text-xl font-bold text-slate-300 dark:text-slate-600">
                                    /{score.total_questions}
                                </span>
                            </div>

                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 mb-8">
                                Correct Answers
                            </span>

                            {/* Progress dots */}
                            <div className="flex gap-2 mb-6">
                                {[...Array(score.total_questions || 5)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 rounded-full ${i < score.score ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-white/10'}`}
                                    />
                                ))}
                            </div>

                            {score.score === score.total_questions && (
                                <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 mb-2 border border-amber-100 dark:border-amber-500/20">
                                    <Trophy className="w-4 h-4" />
                                    Perfect Score! Certified BFF.
                                </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-slate-50 dark:border-white/5 w-full flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400">Date Played</span>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {new Date(score.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Questions List */}
                    <div className="w-full mt-10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Sparkles size={16} className="text-indigo-500" /> Question Breakdown
                            </h3>
                            {!isPro && isOwner && (
                                <div className="px-3 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                    5 ★ to unlock
                                </div>
                            )}
                        </div>

                        <DykmResultQuestions
                            scoreId={scoreId}
                            answers={score.answers}
                            revealedIndices={revealedIndices}
                            isPro={isPro}
                            isOwner={isOwner}
                        />
                    </div>
                </div>
            </main>
        </div>
    )
}
