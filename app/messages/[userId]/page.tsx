import { createSupabaseServerClient } from '@/lib/supabase/server'
import { unstable_cache } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import DirectMessageClient from '@/components/tod/DirectMessageClient'

// Cache the target profile lookup — username rarely changes
const getTargetProfile = (userId: string) =>
    unstable_cache(
        async () => {
            const supabase = await createSupabaseServerClient()
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .single()
            if (error || !data) return null
            return data
        },
        [`dm-target-profile-${userId}`],
        { revalidate: 3600, tags: [`profile-${userId}`] }
    )()

export default async function MessagePage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params

    if (!userId) notFound()

    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const targetProfile = await getTargetProfile(userId)

    if (!targetProfile) notFound()

    return (
        <DirectMessageClient
            targetUserId={userId}
            targetUsername={targetProfile.username}
        />
    )
}
