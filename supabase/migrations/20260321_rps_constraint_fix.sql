-- Fixes the check constraint that limits rounds to a maximum of 9.
-- If players tie repeatedly, matches can exceed 9 rounds easily.

ALTER TABLE public.rps_matches DROP CONSTRAINT IF EXISTS rps_matches_current_round_check;
ALTER TABLE public.rps_matches DROP CONSTRAINT IF EXISTS valid_round;
ALTER TABLE public.rps_matches ADD CONSTRAINT valid_round CHECK (current_round >= 1);
