-- Migration: Create blocked_anonymous table for IP+UA-based anonymous blocking
CREATE TABLE IF NOT EXISTS blocked_anonymous (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ip_address text NOT NULL,
  user_agent text,
  label text DEFAULT 'Anonymous',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(blocker_id, ip_address)
);

ALTER TABLE blocked_anonymous ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own anonymous blocks"
  ON blocked_anonymous
  FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);
