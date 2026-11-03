CREATE TABLE IF NOT EXISTS public.tod_message_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES public.tod_lobbies(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.tod_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioned_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_tod_message_mentions_user
  ON public.tod_message_mentions (mentioned_user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tod_message_mentions_lobby
  ON public.tod_message_mentions (lobby_id, created_at DESC);

ALTER TABLE public.tod_message_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tod mentions" ON public.tod_message_mentions;
CREATE POLICY "Users can view their own tod mentions"
ON public.tod_message_mentions FOR SELECT
USING (auth.uid() = mentioned_user_id);

DROP POLICY IF EXISTS "Participants can insert mentions in their lobby" ON public.tod_message_mentions;
CREATE POLICY "Participants can insert mentions in their lobby"
ON public.tod_message_mentions FOR INSERT
WITH CHECK (
  auth.uid() = mentioned_by_user_id AND
  EXISTS (
    SELECT 1
    FROM public.tod_participants tp
    WHERE tp.lobby_id = tod_message_mentions.lobby_id
      AND tp.user_id = auth.uid()
      AND tp.status = 'joined'
  )
);

DROP POLICY IF EXISTS "Users can update their own tod mentions" ON public.tod_message_mentions;
CREATE POLICY "Users can update their own tod mentions"
ON public.tod_message_mentions FOR UPDATE
USING (auth.uid() = mentioned_user_id)
WITH CHECK (auth.uid() = mentioned_user_id);

DROP POLICY IF EXISTS "Users can delete their own tod mentions" ON public.tod_message_mentions;
CREATE POLICY "Users can delete their own tod mentions"
ON public.tod_message_mentions FOR DELETE
USING (auth.uid() = mentioned_user_id);

ALTER TABLE public.hidden_notifications
DROP CONSTRAINT IF EXISTS hidden_notifications_notification_type_check;

ALTER TABLE public.hidden_notifications
ADD CONSTRAINT hidden_notifications_notification_type_check
CHECK (notification_type IN (
  'confession',
  'dykm_score',
  'lobby_event',
  'xp_transaction',
  'hot_seat_question',
  'mention'
));

ALTER PUBLICATION supabase_realtime ADD TABLE public.tod_message_mentions;
