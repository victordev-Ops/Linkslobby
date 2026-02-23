-- RLS policies for marking notifications as read

-- 1. xp_transactions: Allow users to update their own is_read status
CREATE POLICY "Users can mark their own XP transactions as read"
ON xp_transactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. hot_seat_questions: Allow hosts to mark questions in their sessions as read
CREATE POLICY "Hosts can mark hot seat questions as read"
ON hot_seat_questions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM hot_seat_sessions 
    WHERE hot_seat_sessions.id = hot_seat_questions.session_id 
    AND hot_seat_sessions.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hot_seat_sessions 
    WHERE hot_seat_sessions.id = hot_seat_questions.session_id 
    AND hot_seat_sessions.host_id = auth.uid()
  )
);

-- 3. confessions: Ensure owners can update read status (usually already allowed but let's be explicit if needed)
-- Note: Check if policy already exists to avoid errors. 
-- For simplicity in migration, we use DO block or just assume we can add.
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'confessions' AND policyname = 'Users can mark their own confessions as read'
  ) THEN
    CREATE POLICY "Users can mark their own confessions as read"
    ON confessions FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);
  END IF;
END $$;

-- 4. dykm_scores: Ensure quiz owners can update read status
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dykm_scores' AND policyname = 'Quiz owners can mark scores as read'
  ) THEN
    CREATE POLICY "Quiz owners can mark scores as read"
    ON dykm_scores FOR UPDATE
    USING (auth.uid() = quiz_owner_id)
    WITH CHECK (auth.uid() = quiz_owner_id);
  END IF;
END $$;
