import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DirectMessageClient from '@/components/tod/DirectMessageClient'

export default async function MessagePage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params

    if (!userId) notFound()

    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()

    if (!targetProfile) notFound()

    return (
        <DirectMessageClient
            targetUserId={userId}
            targetUsername={targetProfile.username}
        />
    )
}

