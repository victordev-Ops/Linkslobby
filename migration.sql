-- Hot Seat Sessions
CREATE TABLE IF NOT EXISTS hot_seat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES profiles(id) NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Hot Seat',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hot Seat Participants
CREATE TABLE IF NOT EXISTS hot_seat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hot_seat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT DEFAULT 'joined' CHECK (status IN ('joined', 'pending', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Hot Seat Questions
CREATE TABLE IF NOT EXISTS hot_seat_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hot_seat_sessions(id) ON DELETE CASCADE NOT NULL,
  asker_id UUID REFERENCES profiles(id) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'answered', 'skipped', 'timed_out')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE hot_seat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_seat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_seat_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Sessions
CREATE POLICY "Anyone can read sessions" ON hot_seat_sessions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create sessions" ON hot_seat_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host can update session" ON hot_seat_sessions FOR UPDATE USING (auth.uid() = host_id);

-- Participants
CREATE POLICY "Anyone can read participants" ON hot_seat_participants FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join" ON hot_seat_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Questions
CREATE POLICY "Anyone can read questions" ON hot_seat_questions FOR SELECT USING (true);
CREATE POLICY "Authenticated can ask" ON hot_seat_questions FOR INSERT WITH CHECK (auth.uid() = asker_id);
CREATE POLICY "Host can update questions" ON hot_seat_questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM hot_seat_sessions WHERE id = session_id AND host_id = auth.uid())
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_sessions, hot_seat_participants, hot_seat_questions;
