-- Create hidden_notifications table
CREATE TABLE IF NOT EXISTS hidden_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_id, notification_type),
  CONSTRAINT hidden_notifications_notification_type_check 
    CHECK (notification_type IN ('confession', 'dykm_score', 'lobby_event', 'xp_transaction', 'hot_seat_question'))
);

-- In case the table already existed with a more restrictive constraint, we try to drop and re-add or just ignore if it matches
-- Note: Supabase migrations are usually cleaner if we just add the ALTER if table exists
ALTER TABLE hidden_notifications 
DROP CONSTRAINT IF EXISTS hidden_notifications_notification_type_check;

ALTER TABLE hidden_notifications 
ADD CONSTRAINT hidden_notifications_notification_type_check 
CHECK (notification_type IN ('confession', 'dykm_score', 'lobby_event', 'xp_transaction', 'hot_seat_question'));

-- Enable RLS
ALTER TABLE hidden_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can read their own hidden notifications" ON hidden_notifications;
CREATE POLICY "Users can read their own hidden notifications"
ON hidden_notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can hide their own notifications" ON hidden_notifications;
CREATE POLICY "Users can hide their own notifications"
ON hidden_notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own hidden notifications" ON hidden_notifications;
CREATE POLICY "Users can update their own hidden notifications"
ON hidden_notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unhide their own notifications" ON hidden_notifications;
CREATE POLICY "Users can unhide their own notifications"
ON hidden_notifications FOR DELETE
USING (auth.uid() = user_id);
