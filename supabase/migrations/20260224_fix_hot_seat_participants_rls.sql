-- Fix RLS for hot_seat_participants
-- Allow users to update their own participant status (needed for upsert)
CREATE POLICY "Users can update their own participant row" ON hot_seat_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own participant row (needed for leaving)
CREATE POLICY "Users can delete their own participant row" ON hot_seat_participants
  FOR DELETE USING (auth.uid() = user_id);

-- Allow session hosts to manage all participants in their session (needed for banning)
CREATE POLICY "Host can manage participants in their session" ON hot_seat_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM hot_seat_sessions WHERE id = session_id AND host_id = auth.uid())
  );
