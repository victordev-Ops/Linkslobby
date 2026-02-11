import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DirectMessageClient from '@/components/tod/DirectMessageClient'

export default async function MessagePage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params

    if (!userId) notFound()

    const supabase = await createSupabaseServerClient()

    // Verify User Exists
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch Target Profile
    const { data: targetProfile, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()

    if (error || !targetProfile) {
        notFound() // Or show error "User not found"
    }

    return (
        <DirectMessageClient
            targetUserId={userId}
            targetUsername={targetProfile.username}
        />
    )
}
