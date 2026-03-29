-- ============================================================
-- RPS V2 Schema — Production-Grade Refactor
-- ============================================================
-- Adds: round audit table, move deadline, AI tracking,
-- idempotency, XP safety constraint, match history view.
-- ============================================================

-- ─── 1. rps_rounds — Immutable Audit Table ─────────────────────

CREATE TABLE IF NOT EXISTS public.rps_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.rps_matches(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  move_a text NOT NULL CHECK (move_a IN ('rock','paper','scissors')),
  move_b text NOT NULL CHECK (move_b IN ('rock','paper','scissors')),
  result text NOT NULL CHECK (result IN ('a_wins','b_wins','tie')),
  ai_played boolean NOT NULL DEFAULT false,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_rps_rounds_match
  ON rps_rounds(match_id, round_number);

ALTER TABLE public.rps_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rounds for own matches"
  ON rps_rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rps_matches m
      WHERE m.id = rps_rounds.match_id
        AND (m.player_a = auth.uid() OR m.player_b = auth.uid())
    )
  );

CREATE POLICY "Service role full access on rps_rounds"
  ON rps_rounds FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 2. Schema Additions to rps_matches ────────────────────────

-- 2a. Expand status enum to include new states
ALTER TABLE public.rps_matches DROP CONSTRAINT IF EXISTS rps_matches_status_check;

-- Check if the old unnamed constraint exists and drop it
DO $$ BEGIN
  ALTER TABLE public.rps_matches DROP CONSTRAINT IF EXISTS rps_matches_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Re-add with expanded values
ALTER TABLE public.rps_matches ADD CONSTRAINT rps_matches_status_check
  CHECK (status IN ('waiting','active','completed','cancelled','timeout'));

-- 2b. Move deadline for timeout enforcement
ALTER TABLE public.rps_matches
  ADD COLUMN IF NOT EXISTS move_deadline_at timestamptz;

-- 2c. Track which side is AI (NULL = no AI involvement)
ALTER TABLE public.rps_matches
  ADD COLUMN IF NOT EXISTS ai_player text;

-- Add constraint separately so it doesn't fail if column already exists
DO $$ BEGIN
  ALTER TABLE public.rps_matches
    ADD CONSTRAINT rps_matches_ai_player_check
    CHECK (ai_player IS NULL OR ai_player IN ('a','b'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2d. Idempotency key — increments on every round resolution
ALTER TABLE public.rps_matches
  ADD COLUMN IF NOT EXISTS round_version int NOT NULL DEFAULT 0;

-- 2e. Index for timeout cron queries
CREATE INDEX IF NOT EXISTS idx_rps_matches_deadline
  ON rps_matches(move_deadline_at)
  WHERE status = 'active' AND move_deadline_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rps_matches_stale_waiting
  ON rps_matches(created_at)
  WHERE status = 'waiting';

-- ─── 3. XP Safety Constraint ──────────────────────────────────

-- Ensure xp_balance can never go negative (treats XP like money)
-- Wrap in DO block in case any user has negative balance already
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT xp_non_negative CHECK (xp_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN check_violation THEN
           RAISE WARNING 'Some profiles have negative xp_balance — constraint NOT added. Fix data first.';
END $$;

-- ─── 4. Match History View ────────────────────────────────────

CREATE OR REPLACE VIEW public.rps_match_history AS
SELECT
  m.id AS match_id,
  m.player_a,
  m.player_b,
  m.mode,
  m.stake_amount,
  m.best_of,
  m.score_a,
  m.score_b,
  m.status,
  m.winner_id,
  m.ai_player,
  m.created_at,
  m.completed_at,
  pa.username AS player_a_name,
  pa.avatar_url AS player_a_avatar,
  pb.username AS player_b_name,
  pb.avatar_url AS player_b_avatar,
  pw.username AS winner_name
FROM rps_matches m
LEFT JOIN profiles pa ON pa.id = m.player_a
LEFT JOIN profiles pb ON pb.id = m.player_b
LEFT JOIN profiles pw ON pw.id = m.winner_id;

-- ─── 5. Enable realtime for rps_rounds ────────────────────────

-- Safe: if already added, Postgres will just skip
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rps_rounds;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
