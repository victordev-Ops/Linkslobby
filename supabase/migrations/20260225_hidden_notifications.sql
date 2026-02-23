-- Create hidden_notifications table
CREATE TABLE IF NOT EXISTS hidden_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_id, notification_type)
);

-- Enable RLS
ALTER TABLE hidden_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read their own hidden notifications"
ON hidden_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can hide their own notifications"
ON hidden_notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hidden notifications"
ON hidden_notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unhide their own notifications"
ON hidden_notifications FOR DELETE
USING (auth.uid() = user_id);
