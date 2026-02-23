// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client using the service role key.
 * Use this only for internal system checks that need to bypass RLS,
 * like verifying if a sender is blocked by a recipient.
 */
export function createSupabaseAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase admin credentials missing from environment variables')
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}
