// In sendFriendRequest, delete:
    // Notify the addressee of the incoming friend request
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()

        const username = profile?.username || 'Someone'

        await supabase.from('xp_transactions').insert({
            user_id: targetUserId,
            amount: 0,
            type: 'earn',
            reason: `👋 You received a friend request from @${username}`,
            is_read: false,
        })
    } catch (notifErr) {
        console.error('Friend request notification error:', notifErr)
        // Non-critical — don't fail the request
    }

// In acceptFriendRequest, delete:
    // Notify the requester that their request was accepted
    try {
        // Fetch the friendship to get requester_id
        const { data: friendship } = await supabase
            .from('friendships')
            .select('requester_id')
            .eq('id', friendshipId)
            .single()

        if (friendship) {
            // Get current user's username for the notification message
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single()

            const username = profile?.username || 'Someone'

            await supabase.from('xp_transactions').insert({
                user_id: friendship.requester_id,
                amount: 0,
                type: 'earn',
                reason: `🤝 @${username} accepted your friend request!`,
                is_read: false,
            })
        }
    } catch (notifErr) {
        console.error('Friend accept notification error:', notifErr)
        // Non-critical — don't fail the accept
    }

// In declineFriendRequest, delete:
    // Notify the requester that their request was declined
    if (friendship) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single()

            const username = profile?.username || 'Someone'

            await supabase.from('xp_transactions').insert({
                user_id: friendship.requester_id,
                amount: 0,
                type: 'earn',
                reason: `😔 @${username} declined your friend request`,
                is_read: false,
            })
        } catch (notifErr) {
            console.error('Friend decline notification error:', notifErr)
        }
                }
