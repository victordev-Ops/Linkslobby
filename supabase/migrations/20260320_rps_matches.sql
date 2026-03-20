-- ============================================
-- RPS Game System — Server-Authoritative Matches
-- ============================================
-- All XP mutations happen atomically inside RPCs.
-- The client only renders state and sends user intent.

-- ─── Table ───────────────────────────────────────────────────────────

CREATE TABLE public.rps_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Players
  player_a uuid NOT NULL REFERENCES public.profiles(id),
  player_b uuid REFERENCES public.profiles(id),  -- NULL for solo (vs computer)

  -- Match configuration
  mode text NOT NULL CHECK (mode IN ('solo', 'friend')),
  stake_amount int NOT NULL DEFAULT 100,
  best_of int NOT NULL DEFAULT 5,
  room_code text,  -- 6-char code for multiplayer matchmaking

  -- Scores (best of 5 = first to 3)
  score_a int NOT NULL DEFAULT 0,
  score_b int NOT NULL DEFAULT 0,
  current_round int NOT NULL DEFAULT 1,

  -- Current round moves (cleared after each round resolves)
  move_a text CHECK (move_a IS NULL OR move_a IN ('rock', 'paper', 'scissors')),
  move_b text CHECK (move_b IS NULL OR move_b IN ('rock', 'paper', 'scissors')),

  -- Escrow tracking
  escrow_a boolean NOT NULL DEFAULT false,
  escrow_b boolean NOT NULL DEFAULT false,

  -- Match lifecycle
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'completed', 'cancelled', 'expired')),
  winner_id uuid REFERENCES public.profiles(id),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  round_started_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  -- Constraints
  CONSTRAINT valid_scores CHECK (score_a >= 0 AND score_b >= 0),
  CONSTRAINT valid_round CHECK (current_round >= 1 AND current_round <= 9),
  CONSTRAINT valid_stake CHECK (stake_amount >= 1)
);

-- ─── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX idx_rps_matches_player_a ON rps_matches(player_a, status);
CREATE INDEX idx_rps_matches_player_b ON rps_matches(player_b, status);
CREATE INDEX idx_rps_matches_room_code ON rps_matches(room_code) WHERE room_code IS NOT NULL AND status = 'waiting';
CREATE INDEX idx_rps_matches_active ON rps_matches(status) WHERE status IN ('waiting', 'active');

-- ─── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.rps_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matches"
  ON rps_matches FOR SELECT
  USING (auth.uid() = player_a OR auth.uid() = player_b);

-- Service role can do everything (for timeout cron)
CREATE POLICY "Service role full access"
  ON rps_matches FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================================
-- RPC 1: rps_create_match
-- Creates a match and atomically locks the creator's escrow.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rps_create_match(
  p_mode text,
  p_stake int DEFAULT 100,
  p_room_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance int;
  v_match_id uuid;
  v_room text;
  v_is_solo boolean := (p_mode = 'solo');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_mode NOT IN ('solo', 'friend') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid mode');
  END IF;

  -- Prevent multiple active matches
  IF EXISTS (
    SELECT 1 FROM rps_matches
    WHERE (player_a = v_user_id OR player_b = v_user_id)
      AND status IN ('waiting', 'active')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You already have an active match');
  END IF;

  -- Check balance
  SELECT xp_balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF p_stake < 1 THEN
    RETURN json_build_object('success', false, 'error', 'Stake must be at least 1');
  END IF;

  IF v_balance < p_stake THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient stars',
      'current_balance', v_balance, 'required', p_stake);
  END IF;

  -- Generate room code for friend mode
  IF NOT v_is_solo THEN
    v_room := COALESCE(p_room_code, upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)));
  END IF;

  -- Atomically lock escrow
  UPDATE profiles SET xp_balance = xp_balance - p_stake WHERE id = v_user_id;
  INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
    VALUES (v_user_id, p_stake, 'spend', '🔒 RPS match escrow',
      json_build_object('game', 'rps', 'action', 'escrow_lock')::jsonb);

  -- Create the match
  INSERT INTO rps_matches (player_a, mode, stake_amount, room_code, escrow_a, escrow_b, status)
    VALUES (
      v_user_id,
      p_mode,
      p_stake,
      v_room,
      true,
      v_is_solo,  -- computer doesn't need escrow
      CASE WHEN v_is_solo THEN 'active' ELSE 'waiting' END
    )
    RETURNING id INTO v_match_id;

  RETURN json_build_object(
    'success', true,
    'match_id', v_match_id,
    'stake', p_stake,
    'room_code', v_room,
    'new_balance', v_balance - p_stake
  );
END;
$$;

-- =====================================================================
-- RPC 2: rps_join_match
-- Joins an existing match by room code, locks joiner's escrow.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rps_join_match(p_room_code text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match rps_matches%ROWTYPE;
  v_balance int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Prevent joining if already in a match
  IF EXISTS (
    SELECT 1 FROM rps_matches
    WHERE (player_a = v_user_id OR player_b = v_user_id)
      AND status IN ('waiting', 'active')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You already have an active match');
  END IF;

  -- Find and lock the waiting match
  SELECT * INTO v_match FROM rps_matches
    WHERE room_code = upper(trim(p_room_code))
      AND status = 'waiting'
      AND player_b IS NULL
      AND mode = 'friend'
    FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Room not found or already full');
  END IF;

  IF v_match.player_a = v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot join your own match');
  END IF;

  -- Check balance
  SELECT xp_balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance < v_match.stake_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient stars',
      'required', v_match.stake_amount, 'current_balance', v_balance);
  END IF;

  -- Lock escrow for player B
  UPDATE profiles SET xp_balance = xp_balance - v_match.stake_amount WHERE id = v_user_id;
  INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
    VALUES (v_user_id, v_match.stake_amount, 'spend', '🔒 RPS match escrow',
      json_build_object('game', 'rps', 'action', 'escrow_lock', 'match_id', v_match.id)::jsonb);

  -- Activate the match
  UPDATE rps_matches SET
    player_b = v_user_id,
    escrow_b = true,
    status = 'active',
    round_started_at = now(),
    updated_at = now()
  WHERE id = v_match.id;

  RETURN json_build_object(
    'success', true,
    'match_id', v_match.id,
    'stake', v_match.stake_amount,
    'new_balance', v_balance - v_match.stake_amount
  );
END;
$$;

-- =====================================================================
-- RPC 3: rps_submit_move
-- Records a move. If both players have moved, auto-resolves the round.
-- On match completion, distributes escrow to the winner.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rps_submit_move(p_match_id uuid, p_move text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match rps_matches%ROWTYPE;
  v_is_player_a boolean;
  v_final_move_a text;
  v_final_move_b text;
  v_round_result text;  -- 'a_wins', 'b_wins', 'tie'
  v_new_score_a int;
  v_new_score_b int;
  v_match_winner uuid;
  v_win_target int;
  v_computer_move text;
  v_moves text[] := ARRAY['rock', 'paper', 'scissors'];
  v_pool int;
BEGIN
  IF p_move NOT IN ('rock', 'paper', 'scissors') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid move');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Lock the match row
  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not active');
  END IF;

  -- Identify which player
  v_is_player_a := (v_user_id = v_match.player_a);
  IF NOT v_is_player_a AND (v_match.player_b IS NULL OR v_user_id != v_match.player_b) THEN
    RETURN json_build_object('success', false, 'error', 'You are not in this match');
  END IF;

  -- Prevent double-move in same round
  IF v_is_player_a AND v_match.move_a IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You already submitted a move this round');
  END IF;
  IF NOT v_is_player_a AND v_match.move_b IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You already submitted a move this round');
  END IF;

  -- Record the move
  IF v_is_player_a THEN
    UPDATE rps_matches SET move_a = p_move, updated_at = now() WHERE id = p_match_id;
  ELSE
    UPDATE rps_matches SET move_b = p_move, updated_at = now() WHERE id = p_match_id;
  END IF;

  -- For solo mode: generate computer move when player submits
  IF v_match.mode = 'solo' AND v_is_player_a THEN
    v_computer_move := v_moves[1 + floor(random() * 3)::int];
    UPDATE rps_matches SET move_b = v_computer_move, updated_at = now() WHERE id = p_match_id;
  END IF;

  -- Re-read current state to get both moves
  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id;

  v_final_move_a := v_match.move_a;
  v_final_move_b := v_match.move_b;

  -- If only one player has moved, return waiting status
  IF v_final_move_a IS NULL OR v_final_move_b IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'status', 'waiting_for_opponent',
      'your_move', p_move
    );
  END IF;

  -- ═══ BOTH MOVES IN — RESOLVE THE ROUND ═══

  -- Determine round winner
  IF v_final_move_a = v_final_move_b THEN
    v_round_result := 'tie';
  ELSIF (v_final_move_a = 'rock' AND v_final_move_b = 'scissors') OR
        (v_final_move_a = 'paper' AND v_final_move_b = 'rock') OR
        (v_final_move_a = 'scissors' AND v_final_move_b = 'paper') THEN
    v_round_result := 'a_wins';
  ELSE
    v_round_result := 'b_wins';
  END IF;

  v_new_score_a := v_match.score_a + CASE WHEN v_round_result = 'a_wins' THEN 1 ELSE 0 END;
  v_new_score_b := v_match.score_b + CASE WHEN v_round_result = 'b_wins' THEN 1 ELSE 0 END;
  v_win_target := (v_match.best_of / 2) + 1;  -- 3 for best-of-5

  -- Check if match is over
  IF v_new_score_a >= v_win_target THEN
    v_match_winner := v_match.player_a;
  ELSIF v_new_score_b >= v_win_target THEN
    v_match_winner := v_match.player_b;
  END IF;

  -- Update match state
  UPDATE rps_matches SET
    score_a = v_new_score_a,
    score_b = v_new_score_b,
    current_round = v_match.current_round + 1,
    move_a = NULL,  -- Clear for next round
    move_b = NULL,
    round_started_at = CASE WHEN v_match_winner IS NULL THEN now() ELSE round_started_at END,
    status = CASE WHEN v_match_winner IS NOT NULL THEN 'completed' ELSE 'active' END,
    winner_id = v_match_winner,
    completed_at = CASE WHEN v_match_winner IS NOT NULL THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_match_id;

  -- ═══ ESCROW DISTRIBUTION (on match completion) ═══
  IF v_match_winner IS NOT NULL THEN
    v_pool := v_match.stake_amount * 2;

    IF v_match.mode = 'solo' THEN
      -- Solo win: player gets 2x stake back
      IF v_match_winner = v_match.player_a THEN
        UPDATE profiles SET xp_balance = xp_balance + v_pool WHERE id = v_match.player_a;
        INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
          VALUES (v_match.player_a, v_pool, 'earn', '🏆 Won RPS match!',
            json_build_object('game', 'rps', 'match_id', p_match_id,
              'score', v_new_score_a || '-' || v_new_score_b)::jsonb);
      END IF;
      -- Solo loss: stake already deducted via escrow, nothing to do
    ELSE
      -- Multiplayer: winner gets the entire pool
      UPDATE profiles SET xp_balance = xp_balance + v_pool WHERE id = v_match_winner;
      INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
        VALUES (v_match_winner, v_pool, 'earn', '🏆 Won RPS match!',
          json_build_object('game', 'rps', 'match_id', p_match_id,
            'score', v_new_score_a || '-' || v_new_score_b)::jsonb);
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'status', CASE WHEN v_match_winner IS NOT NULL THEN 'match_completed' ELSE 'round_resolved' END,
    'round_result', v_round_result,
    'move_a', v_final_move_a,
    'move_b', v_final_move_b,
    'score_a', v_new_score_a,
    'score_b', v_new_score_b,
    'winner_id', v_match_winner,
    'current_round', v_match.current_round + 1
  );
END;
$$;

-- =====================================================================
-- RPC 4: rps_cancel_match
-- Cancels/forfeits a match. Refunds if waiting, forfeits if active.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rps_cancel_match(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match rps_matches%ROWTYPE;
  v_other_player uuid;
  v_pool int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status NOT IN ('waiting', 'active') THEN
    RETURN json_build_object('success', false, 'error', 'Match already ended');
  END IF;

  IF v_user_id != v_match.player_a AND v_user_id != v_match.player_b THEN
    RETURN json_build_object('success', false, 'error', 'Not your match');
  END IF;

  -- ─── WAITING: no opponent yet → full refund ───
  IF v_match.status = 'waiting' THEN
    UPDATE profiles SET xp_balance = xp_balance + v_match.stake_amount
      WHERE id = v_match.player_a;
    INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
      VALUES (v_match.player_a, v_match.stake_amount, 'earn', '↩️ RPS match cancelled (refund)',
        json_build_object('game', 'rps', 'match_id', p_match_id, 'action', 'refund')::jsonb);

    UPDATE rps_matches SET status = 'cancelled', updated_at = now(), completed_at = now()
      WHERE id = p_match_id;

    RETURN json_build_object('success', true, 'action', 'refunded');
  END IF;

  -- ─── ACTIVE: forfeiter loses stake ───
  IF v_match.mode = 'solo' THEN
    -- Solo forfeit: stake already gone, just mark completed
    UPDATE rps_matches SET
      status = 'completed',
      winner_id = NULL,  -- no winner on forfeit vs computer
      completed_at = now(),
      updated_at = now()
    WHERE id = p_match_id;

    RETURN json_build_object('success', true, 'action', 'forfeited_solo');
  END IF;

  -- Friend mode: other player wins the pool
  v_other_player := CASE
    WHEN v_user_id = v_match.player_a THEN v_match.player_b
    ELSE v_match.player_a
  END;

  IF v_other_player IS NOT NULL THEN
    v_pool := v_match.stake_amount * 2;
    UPDATE profiles SET xp_balance = xp_balance + v_pool WHERE id = v_other_player;
    INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
      VALUES (v_other_player, v_pool, 'earn', '🏆 Opponent forfeited RPS!',
        json_build_object('game', 'rps', 'match_id', p_match_id, 'action', 'opponent_forfeit')::jsonb);
  END IF;

  UPDATE rps_matches SET
    status = 'completed',
    winner_id = v_other_player,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_match_id;

  RETURN json_build_object('success', true, 'action', 'forfeited', 'winner_id', v_other_player);
END;
$$;

-- =====================================================================
-- Permissions: allow authenticated users to call
-- =====================================================================

GRANT EXECUTE ON FUNCTION public.rps_create_match(text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rps_join_match(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rps_submit_move(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rps_cancel_match(uuid) TO authenticated;

-- Enable realtime for the rps_matches table so clients can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE rps_matches;
