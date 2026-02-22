-- Add image support and sender tracking to confessions (for DMs)
ALTER TABLE public.confessions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.confessions ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id);

-- Add index for faster DM history lookup
CREATE INDEX IF NOT EXISTS idx_confessions_sender_id ON public.confessions(sender_id);
CREATE INDEX IF NOT EXISTS idx_confessions_profile_id_sender_id ON public.confessions(profile_id, sender_id);
