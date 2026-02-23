-- Add is_read column to tables that represent notifications
ALTER TABLE xp_transactions ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE hot_seat_questions ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Create table to track read status for shared/system notifications (e.g. tod_messages)
CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_id, notification_type)
);

-- Enable RLS
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own read statuses" 
ON notification_reads FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read statuses" 
ON notification_reads FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for read statuses
ALTER PUBLICATION supabase_realtime ADD TABLE notification_reads;
