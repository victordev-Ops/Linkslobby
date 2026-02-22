'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function uploadDmPhoto(formData: FormData) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const file = formData.get('file') as File
        if (!file) throw new Error('No file provided')

        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${uuidv4()}.${fileExt}`

        // Upload to 'chat-attachments' bucket
        const { data, error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) {
            console.error('Photo Upload Error:', uploadError)
            throw uploadError
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(fileName)

        return { success: true, url: publicUrl }
    } catch (error) {
        console.error('uploadDmPhoto Error:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Upload failed' }
    }
}
