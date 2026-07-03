'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7 // 7 days

/**
 * Uploads a DM photo attachment.
 * - Requires an active sessionId the caller is actually a participant of,
 *   so this can't be used as a general-purpose free upload endpoint.
 * - Validates size + MIME type server-side (never trust the client/extension).
 * - Returns a time-limited SIGNED url, not a public one — DM attachments are
 *   private, so the bucket should be private and URLs should expire.
 */
export async function uploadDmPhoto(sessionId: string, formData: FormData) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        if (!sessionId) throw new Error('Missing session')

        // Confirm the caller is actually a participant in this session before
        // letting them upload anything tied to it.
        const { data: participation } = await supabase
            .from('chat_participants')
            .select('session_id')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .maybeSingle()

        if (!participation) throw new Error('Not a participant of this conversation')

        const file = formData.get('file') as File
        if (!file) throw new Error('No file provided')

        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            throw new Error('Unsupported file type. Please upload a JPEG, PNG, WEBP, or GIF image.')
        }

        if (file.size > MAX_FILE_BYTES) {
            throw new Error(`File too large. Max size is ${MAX_FILE_BYTES / (1024 * 1024)}MB.`)
        }

        // Derive the extension from the validated MIME type, not the client-supplied
        // filename — never trust a client-controlled string as a path segment.
        const extByMime: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
        }
        const fileExt = extByMime[file.type]
        const fileName = `${sessionId}/${user.id}-${Date.now()}-${uuidv4()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) {
            console.error('Photo Upload Error:', uploadError)
            throw uploadError
        }

        // Signed, expiring URL — requires the 'chat-attachments' bucket to be
        // PRIVATE (not public). If it's currently a public bucket, flip that in
        // Supabase Storage settings for this fix to take effect.
        const { data: signed, error: signError } = await supabase.storage
            .from('chat-attachments')
            .createSignedUrl(fileName, SIGNED_URL_EXPIRY_SECONDS)

        if (signError || !signed) {
            console.error('Signed URL Error:', signError)
            throw new Error('Upload succeeded but could not generate access link')
        }

        return { success: true, url: signed.signedUrl, path: fileName }
    } catch (error) {
        console.error('uploadDmPhoto Error:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Upload failed' }
    }
                }
