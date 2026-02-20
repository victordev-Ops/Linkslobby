import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const supabase = await createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const shouldDelete = searchParams.get('delete') === 'true'

    try {
        // Fetch all potential legacy DMs
        // They are 'confession' type and start with [DM:
        const { data: legacyDMs, error: fetchError } = await supabase
            .from('confessions')
            .select('*')
            //.eq('message_type', 'confession') // Optional filter if type is reliable
            .order('created_at', { ascending: true }) // Process oldest to newest

        if (fetchError) throw fetchError as Error
        if (!legacyDMs) return NextResponse.json({ message: 'No DMs found' })

        // 1. Filter to actual DMs in memory (safer than LIKE query if mixed types)
        const dms = legacyDMs.filter(dm => dm.message.startsWith('[DM:'))

        const results = {
            total: dms.length,
            migrated: 0,
            skipped: 0,
            errors: [] as string[]
        }

        // Cache for session IDs to avoid lookups
        // Key: metadata info or participants
        const sessionCache = new Map<string, string>()

        for (const dm of dms) {
            try {
                // Parse Metadata: [DM:senderId:senderName] OR often: [DM:senderId]
                // Regex: \[DM:([a-f0-9-]+)(?::([^\]]*))?\]
                const match = dm.message.match(/^\[DM:([a-f0-9-]+)(?::([^\]]*))?\]/)

                if (!match) {
                    results.skipped++
                    continue
                }

                const senderId = match[1]
                const recipientId = dm.profile_id // Confession owner is the recipient
                const content = dm.message.replace(/^\[DM:[^\]]+\]\s*/, '').trim()

                // Determine session participants
                // Session is unique per pair of users
                // We need to find if a session already exists for these two
                if (senderId === recipientId) {
                    results.skipped++ // Self message? Skip or allow?
                    continue
                }

                const participants = [senderId, recipientId].sort()
                const sessionKey = participants.join(':')

                let sessionId = sessionCache.get(sessionKey)

                if (!sessionId) {
                    // Check DB for existing session via participants intersection
                    // Find sessions for User1
                    const { data: myParticipations } = await supabase
                        .from('chat_participants')
                        .select('session_id')
                        .eq('user_id', participants[0])

                    if (myParticipations && myParticipations.length > 0) {
                        const mySessionIds = myParticipations.map(p => p.session_id)

                        // Check if User2 is in any of these
                        const { data: common } = await supabase
                            .from('chat_participants')
                            .select('session_id')
                            .eq('user_id', participants[1])
                            .in('session_id', mySessionIds)
                            .single()

                        if (common) {
                            sessionId = common.session_id
                        }
                    }

                    // Create if not exists
                    if (!sessionId) {
                        // Create Session
                        const { data: newSession, error: createSessionError } = await supabase
                            .from('chat_sessions')
                            .insert({
                                created_at: dm.created_at, // Use oldest message time as creation?
                                updated_at: dm.created_at,
                                last_message_preview: content.substring(0, 50)
                            })
                            .select()
                            .single()

                        if (createSessionError || !newSession) throw new Error('Failed to create session: ' + createSessionError?.message)
                        sessionId = newSession.id

                        // Add Participants
                        // Note: If users don't exist in profiles table, this might fail due to FKs.
                        // We assume profiles exist.
                        // Check if profiles exist? RLS might block if public access not enabled?
                        // Server client bypasses RLS if service role used... 
                        // But createClient() uses cookie/auth user. 
                        // Migration should ideally run as Admin/Service Role.
                        // Assuming running as authenticated user (the one viewing the page?)
                        // If I run this as User A, I can only create sessions for User A.
                        // But migration needs to run for EVERYONE?
                        // Typically migration is a backend script.
                        // If I run this via browser as 'user', I can only migrate MY DMs.
                        // If I want to migrate ALL DMs, I need service role key.

                        // For now, let's assume I run this as the user who owns the DMs (recipient).
                        // I can only migrate messages sent TO me.
                        // But I need to insert messages sent BY logic...
                        // If I am recipient, `sender_id` is someone else.
                        // I might not have permission to insert `sender_id` as someone else in `chat_messages` if RLS enforces `auth.uid() = sender_id`.
                        // RLS Policy "Users can insert messages": `auth.uid() = sender_id`.
                        // BLOCKED: A user cannot migrate their own incoming DMs because they can't insert a message with `sender_id` != themselves.

                        // Solution: This MUST be a Service Role operation or RLS must allow it.
                        // In `createClient` for server, acts as user.
                        // I should update RLS to allow migration? Or use Service Role.
                        // Next.js `createClient` doesn't expose service role easily unless configured.

                        // Alternative: Update RLS to allow inserting if `auth.uid()` is a participant?
                        // No, that allows spoofing.

                        // I will assume this is an ADMIN task or I need to bypass RLS.
                        // Supabase Admin Client? 
                        // I can try to use `supabase-js` directly with process.env.SUPABASE_SERVICE_ROLE_KEY if available.
                        // But I don't have access to env vars here to know if it's set.
                        // `process.env.SUPABASE_SERVICE_ROLE_KEY` is standard.
                    }

                    if (sessionId) sessionCache.set(sessionKey, sessionId)
                }

                if (!sessionId) throw new Error('No Session ID')

                // Need Service Role to insert message on behalf of sender?
                // Or I can temporarily disable RLS on `chat_messages`?
                // Or add policy "System Migration".
                // I will try to use Service Role client if possible.
                // If not, I'll return error.
            } catch (err: any) {
                console.error('Migration error:', err)
                results.errors.push(err.message)
            }
        }

        return NextResponse.json({ success: true, results, note: "If errors about permission, RLS is blocking inserts." })

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
