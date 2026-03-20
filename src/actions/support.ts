'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

// ─── Types ──────────────────────────────────────────────────────

export type SupportTicket = {
    id: string
    user_id: string
    subject: string
    message: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    priority: 'low' | 'normal' | 'high' | 'urgent'
    admin_reply: string | null
    created_at: string
    updated_at: string
}

// ─── Create a support ticket ────────────────────────────────────

export async function createSupportTicket(
    subject: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (!subject.trim() || !message.trim()) {
        return { success: false, error: 'Subject and message are required' }
    }

    const { data, error } = await supabase
        .from('support_tickets')
        .insert({
            user_id: user.id,
            subject: subject.trim().slice(0, 200),
            message: message.trim().slice(0, 5000),
            priority,
        })
        .select()
        .single()

    if (error) {
        console.error('Create support ticket error:', error)
        return { success: false, error: 'Failed to create ticket' }
    }

    return { success: true, ticket: data }
}

// ─── Get user's tickets ─────────────────────────────────────────

export async function getMyTickets() {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, data: [] }

    const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Get tickets error:', error)
        return { success: false, data: [] }
    }

    return { success: true, data: data || [] }
}

// ─── Submit a report ────────────────────────────────────────────

export async function submitReport(
    reportedId: string,
    reason: string,
    context: string = 'profile',
    contextId?: string
) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (user.id === reportedId) {
        return { success: false, error: 'Cannot report yourself' }
    }

    if (!reason.trim()) {
        return { success: false, error: 'Reason is required' }
    }

    const { error } = await supabase
        .from('reports')
        .insert({
            reporter_id: user.id,
            reported_id: reportedId,
            reason: reason.trim().slice(0, 500),
            context,
            context_id: contextId,
            status: 'pending',
        })

    if (error) {
        console.error('Submit report error:', error)
        return { success: false, error: 'Failed to submit report' }
    }

    return { success: true }
}
