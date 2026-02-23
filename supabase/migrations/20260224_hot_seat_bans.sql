-- Hot Seat Bans
CREATE TABLE IF NOT EXISTS hot_seat_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hot_seat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE hot_seat_bans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read bans" ON hot_seat_bans FOR SELECT USING (true);
CREATE POLICY "Host can manage bans" ON hot_seat_bans FOR ALL USING (
  EXISTS (SELECT 1 FROM hot_seat_sessions WHERE id = session_id AND host_id = auth.uid())
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_bans;
