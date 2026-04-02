-- ============================================================
-- RPS Disconnect Handling & Stake Protection
-- ============================================================
-- Adds:
--   ✅ Disconnect tracking columns (who, when, count per side)
--   ✅ Updated rps_ai_takeover — keeps mode='friend' so player can return
--   ✅ New rps_player_reconnect — idempotent reconnect with abuse guard
--   ✅ Auto-forfeit on 3rd disconnect in a single match
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- 1. Schema additions
-- ═══════════════════════════════════════════════════════════════

-- Which player is currently disconnected (NULL = nobody)
ALTER TABLE public.rps_matches
  ADD COLUMN IF NOT EXISTS disconnected_player uuid;

-- When the disconnect was detected (for timeout logic)
ALTER TABLE public.rps_matches
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

-- Per-side disconnect counters (anti-exploitation)
ALTER TABLE public.rps_matches
  ADD COLUMN IF NOT EXISTS disconnect_count_a int NOT NULL DEFAULT 0;

ALTER TABLE public.rps_matches
  ADD COLUMN IF NOT EXISTS disconnect_count_b int NOT NULL DEFAULT 0;


-- ═══════════════════════════════════════════════════════════════
-- 2. Updated rps_ai_takeover
--    KEY CHANGE: No longer sets mode='solo'.
--    The match stays 'friend' so the disconnected player can
--    reconnect and resume control after AI finishes the current round.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rps_ai_takeover(
  p_match_id uuid,
  p_disconnected_user_id uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_match rps_matches%ROWTYPE;
  v_remaining_player uuid;
  v_disconnected_is_a boolean;
  v_ai_side text;  -- 'a' or 'b'
  v_dc_count int;
BEGIN
  -- Lock the match
  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Idempotent: if already has AI for this player, return success
  IF v_match.ai_player IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'already_ai',
      'ai_player', v_match.ai_player);
  END IF;

  -- Only active matches can be taken over
  IF v_match.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not active');
  END IF;

  -- Solo matches already have AI
  IF v_match.mode = 'solo' THEN
    RETURN json_build_object('success', false, 'error', 'Match is already solo');
  END IF;

  -- Validate the disconnected player is in the match
  IF p_disconnected_user_id != v_match.player_a AND p_disconnected_user_id != v_match.player_b THEN
    RETURN json_build_object('success', false, 'error', 'User not in this match');
  END IF;

  v_disconnected_is_a := (p_disconnected_user_id = v_match.player_a);
  v_remaining_player := CASE WHEN v_disconnected_is_a THEN v_match.player_b ELSE v_match.player_a END;
  v_ai_side := CASE WHEN v_disconnected_is_a THEN 'a' ELSE 'b' END;

  -- Increment disconnect counter for the disconnecting side
  IF v_disconnected_is_a THEN
    v_dc_count := v_match.disconnect_count_a + 1;
  ELSE
    v_dc_count := v_match.disconnect_count_b + 1;
  END IF;

  -- ═══ ANTI-EXPLOITATION: Auto-forfeit on 3rd disconnect ═══
  IF v_dc_count >= 3 THEN
    -- The serial disconnector loses — award full pool to remaining player
    DECLARE
      v_pool int := v_match.stake_amount * 2;
    BEGIN
      -- Award winner
      IF v_remaining_player IS NOT NULL THEN
        UPDATE profiles SET xp_balance = xp_balance + v_pool WHERE id = v_remaining_player;
        INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
          VALUES (v_remaining_player, v_pool, 'earn', '🏆 Opponent auto-forfeited (too many disconnects)!',
            json_build_object('game', 'rps', 'match_id', p_match_id, 'action', 'auto_forfeit_win')::jsonb);
      END IF;

      -- Log loss for the serial disconnector
      INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
        VALUES (p_disconnected_user_id, 0, 'spend', '🏳️ Auto-forfeited RPS (3 disconnects)',
          json_build_object('game', 'rps', 'match_id', p_match_id, 'action', 'auto_forfeit',
            'disconnect_count', v_dc_count)::jsonb);

      -- End the match
      UPDATE rps_matches SET
        status = 'completed',
        winner_id = v_remaining_player,
        completed_at = now(),
        updated_at = now(),
        disconnect_count_a = CASE WHEN v_disconnected_is_a THEN v_dc_count ELSE v_match.disconnect_count_a END,
        disconnect_count_b = CASE WHEN NOT v_disconnected_is_a THEN v_dc_count ELSE v_match.disconnect_count_b END
      WHERE id = p_match_id;

      RETURN json_build_object(
        'success', true,
        'action', 'auto_forfeit',
        'winner_id', v_remaining_player,
        'disconnect_count', v_dc_count
      );
    END;
  END IF;

  -- ═══ NORMAL AI TAKEOVER ═══
  -- IMPORTANT: mode stays 'friend' so reconnection is possible.
  -- ai_player flag tells rps_submit_move_v2 to generate AI moves.
  UPDATE rps_matches SET
    ai_player = v_ai_side,
    -- mode stays 'friend' — NOT changed to 'solo'
    disconnected_player = p_disconnected_user_id,
    disconnected_at = now(),
    disconnect_count_a = CASE WHEN v_disconnected_is_a THEN v_dc_count ELSE v_match.disconnect_count_a END,
    disconnect_count_b = CASE WHEN NOT v_disconnected_is_a THEN v_dc_count ELSE v_match.disconnect_count_b END,
    move_deadline_at = now() + interval '60 seconds',
    updated_at = now()
  WHERE id = p_match_id;

  -- Log the takeover
  INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
    VALUES (v_remaining_player, 0, 'earn', '🤖 Opponent disconnected — AI taking over temporarily',
      json_build_object('game', 'rps', 'match_id', p_match_id, 'action', 'ai_takeover',
        'ai_side', v_ai_side, 'disconnect_count', v_dc_count)::jsonb);

  RETURN json_build_object(
    'success', true,
    'action', 'ai_takeover',
    'ai_side', v_ai_side,
    'remaining_player_id', v_remaining_player,
    'disconnect_count', v_dc_count
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 3. New RPC: rps_player_reconnect
--    Called when a disconnected player returns to the game.
--    - Idempotent (safe to call multiple times)
--    - If a round is in progress with AI, let it finish first
--      (ai_player is only cleared once moves are NULL, meaning
--       the round resolved). If a round IS mid-play, we keep
--       ai_player set for that round and clear on the NEXT round.
--    - Tracks disconnect count for anti-abuse
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rps_player_reconnect(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match rps_matches%ROWTYPE;
  v_is_player_a boolean;
  v_round_in_progress boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Lock the match
  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Match must still be active
  IF v_match.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Match is no longer active',
      'status', v_match.status);
  END IF;

  -- Only the disconnected player can reconnect
  IF v_match.disconnected_player IS NULL OR v_match.disconnected_player != v_user_id THEN
    -- Idempotent: if they're not marked as disconnected, it's a no-op
    RETURN json_build_object('success', true, 'action', 'already_connected');
  END IF;

  -- Verify the user is actually in this match
  v_is_player_a := (v_user_id = v_match.player_a);
  IF NOT v_is_player_a AND (v_match.player_b IS NULL OR v_user_id != v_match.player_b) THEN
    RETURN json_build_object('success', false, 'error', 'You are not in this match');
  END IF;

  -- Check if a round is mid-play (AI already submitted a move for this round)
  -- If either move slot is filled, a round is in progress — let AI finish it
  v_round_in_progress := (v_match.move_a IS NOT NULL OR v_match.move_b IS NOT NULL);

  IF v_round_in_progress THEN
    -- Clear disconnect marker but KEEP ai_player for this round.
    -- The next call to rps_submit_move_v2 will resolve the round with AI.
    -- After that round resolves, the client should call reconnect again
    -- (or we clear ai_player automatically in the next round start).
    UPDATE rps_matches SET
      disconnected_player = NULL,
      disconnected_at = NULL,
      updated_at = now()
    WHERE id = p_match_id;

    RETURN json_build_object(
      'success', true,
      'action', 'reconnected_round_in_progress',
      'message', 'AI will finish the current round, then you resume control',
      'ai_player', v_match.ai_player,
      'current_round', v_match.current_round
    );
  ELSE
    -- No round in progress — safe to fully clear AI and hand back control
    UPDATE rps_matches SET
      ai_player = NULL,
      disconnected_player = NULL,
      disconnected_at = NULL,
      move_deadline_at = now() + interval '60 seconds',
      updated_at = now()
    WHERE id = p_match_id;

    RETURN json_build_object(
      'success', true,
      'action', 'reconnected',
      'message', 'You are back in control',
      'current_round', v_match.current_round
    );
  END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 4. Update rps_submit_move_v2 — clear ai_player after AI round
--    resolves if the player has reconnected (disconnected_player IS NULL)
-- ═══════════════════════════════════════════════════════════════

-- We need to add a small patch to rps_submit_move_v2:
-- After a round resolves, if ai_player is set but disconnected_player is NULL,
-- it means the player reconnected mid-round. Clear ai_player for the next round.

CREATE OR REPLACE FUNCTION public.rps_submit_move_v2(
  p_match_id uuid,
  p_move text,
  p_round_version int DEFAULT -1
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match rps_matches%ROWTYPE;
  v_is_player_a boolean;
  v_final_move_a text;
  v_final_move_b text;
  v_round_result text;
  v_new_score_a int;
  v_new_score_b int;
  v_match_winner uuid;
  v_is_match_over boolean := false;
  v_win_target int;
  v_computer_move text;
  v_moves text[] := ARRAY['rock', 'paper', 'scissors'];
  v_pool int;
  v_ai_was_used boolean := false;
  v_clear_ai_after boolean := false;
BEGIN
  IF p_move NOT IN ('rock', 'paper', 'scissors') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid move');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- ═══ SINGLE FOR UPDATE LOCK ═══
  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not active');
  END IF;

  -- Idempotency check
  IF p_round_version >= 0 AND p_round_version != v_match.round_version THEN
    RETURN json_build_object(
      'success', true,
      'status', 'stale_version',
      'current_round_version', v_match.round_version,
      'score_a', v_match.score_a,
      'score_b', v_match.score_b,
      'current_round', v_match.current_round
    );
  END IF;

  -- Identify which player
  v_is_player_a := (v_user_id = v_match.player_a);
  IF NOT v_is_player_a AND (v_match.player_b IS NULL OR v_user_id != v_match.player_b) THEN
    RETURN json_build_object('success', false, 'error', 'You are not in this match');
  END IF;

  -- Prevent double-move
  IF v_is_player_a AND v_match.move_a IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You already submitted a move this round',
      'your_move', v_match.move_a);
  END IF;
  IF NOT v_is_player_a AND v_match.move_b IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You already submitted a move this round',
      'your_move', v_match.move_b);
  END IF;

  -- Record the move
  IF v_is_player_a THEN
    v_final_move_a := p_move;
    v_final_move_b := v_match.move_b;
  ELSE
    v_final_move_a := v_match.move_a;
    v_final_move_b := p_move;
  END IF;

  -- For solo mode OR AI-controlled side: generate computer move
  IF v_match.mode = 'solo' AND v_is_player_a THEN
    v_computer_move := v_moves[1 + floor(random() * 3)::int];
    v_final_move_b := v_computer_move;
    v_ai_was_used := true;
  ELSIF v_match.ai_player = 'a' AND NOT v_is_player_a THEN
    v_computer_move := v_moves[1 + floor(random() * 3)::int];
    v_final_move_a := v_computer_move;
    v_ai_was_used := true;
  ELSIF v_match.ai_player = 'b' AND v_is_player_a THEN
    v_computer_move := v_moves[1 + floor(random() * 3)::int];
    v_final_move_b := v_computer_move;
    v_ai_was_used := true;
  END IF;

  -- If only one player has moved (and no AI), write and return
  IF v_final_move_a IS NULL OR v_final_move_b IS NULL THEN
    UPDATE rps_matches SET
      move_a = v_final_move_a,
      move_b = v_final_move_b,
      updated_at = now()
    WHERE id = p_match_id;

    RETURN json_build_object(
      'success', true,
      'status', 'waiting_for_opponent',
      'your_move', p_move,
      'round_version', v_match.round_version
    );
  END IF;

  -- ═══ BOTH MOVES IN — RESOLVE THE ROUND ═══

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
  v_win_target := (v_match.best_of / 2) + 1;

  IF v_new_score_a >= v_win_target THEN
    v_match_winner := v_match.player_a;
    v_is_match_over := true;
  ELSIF v_new_score_b >= v_win_target THEN
    IF v_match.player_b IS NOT NULL THEN
      v_match_winner := v_match.player_b;
    ELSE
      v_match_winner := NULL;
    END IF;
    v_is_match_over := true;
  END IF;

  -- Write to audit table
  INSERT INTO rps_rounds (match_id, round_number, move_a, move_b, result, ai_played)
    VALUES (p_match_id, v_match.current_round, v_final_move_a, v_final_move_b, v_round_result, v_ai_was_used);

  -- ═══ RECONNECTION HANDBACK: If AI was used this round but the player
  --     has reconnected (disconnected_player IS NULL), clear ai_player
  --     so they get control back for the next round. ═══
  IF v_ai_was_used AND v_match.ai_player IS NOT NULL AND v_match.disconnected_player IS NULL THEN
    v_clear_ai_after := true;
  END IF;

  -- Update match state
  UPDATE rps_matches SET
    last_move_a = v_final_move_a,
    last_move_b = v_final_move_b,
    last_round_result = v_round_result,
    score_a = v_new_score_a,
    score_b = v_new_score_b,
    current_round = v_match.current_round + 1,
    move_a = NULL,
    move_b = NULL,
    round_version = v_match.round_version + 1,
    round_started_at = CASE WHEN NOT v_is_match_over THEN now() ELSE round_started_at END,
    move_deadline_at = CASE WHEN NOT v_is_match_over THEN now() + interval '60 seconds' ELSE NULL END,
    status = CASE WHEN v_is_match_over THEN 'completed' ELSE 'active' END,
    winner_id = v_match_winner,
    completed_at = CASE WHEN v_is_match_over THEN now() ELSE NULL END,
    -- Clear AI after reconnected player's AI round finishes
    ai_player = CASE WHEN v_clear_ai_after THEN NULL ELSE ai_player END,
    updated_at = now()
  WHERE id = p_match_id;

  -- ═══ ESCROW DISTRIBUTION ═══
  IF v_is_match_over THEN
    v_pool := v_match.stake_amount * 2;

    IF v_match.mode = 'solo' OR v_match.player_b IS NULL THEN
      IF v_match_winner = v_match.player_a THEN
        UPDATE profiles SET xp_balance = xp_balance + v_pool WHERE id = v_match.player_a;
        INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
          VALUES (v_match.player_a, v_pool, 'earn', '🏆 Won RPS match!',
            json_build_object('game', 'rps', 'match_id', p_match_id,
              'score', v_new_score_a || '-' || v_new_score_b,
              'ai_involved', v_match.ai_player IS NOT NULL)::jsonb);
      ELSE
        INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
          VALUES (v_match.player_a, 0, 'spend', '😔 Lost RPS match (vs Computer)',
            json_build_object('game', 'rps', 'match_id', p_match_id,
              'score', v_new_score_a || '-' || v_new_score_b,
              'action', 'escrow_lost')::jsonb);
      END IF;
    ELSE
      IF v_match_winner IS NOT NULL THEN
        UPDATE profiles SET xp_balance = xp_balance + v_pool WHERE id = v_match_winner;
        INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
          VALUES (v_match_winner, v_pool, 'earn', '🏆 Won RPS match!',
            json_build_object('game', 'rps', 'match_id', p_match_id,
              'score', v_new_score_a || '-' || v_new_score_b,
              'ai_involved', v_match.ai_player IS NOT NULL)::jsonb);

        DECLARE v_loser uuid;
        BEGIN
          v_loser := CASE WHEN v_match_winner = v_match.player_a THEN v_match.player_b ELSE v_match.player_a END;
          IF v_loser IS NOT NULL THEN
            INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
              VALUES (v_loser, 0, 'spend', '😔 Lost RPS match',
                json_build_object('game', 'rps', 'match_id', p_match_id,
                  'score', v_new_score_a || '-' || v_new_score_b,
                  'action', 'escrow_lost')::jsonb);
          END IF;
        END;
      END IF;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'status', CASE WHEN v_is_match_over THEN 'match_completed' ELSE 'round_resolved' END,
    'round_result', v_round_result,
    'move_a', v_final_move_a,
    'move_b', v_final_move_b,
    'score_a', v_new_score_a,
    'score_b', v_new_score_b,
    'winner_id', v_match_winner,
    'current_round', v_match.current_round + 1,
    'round_version', v_match.round_version + 1,
    'ai_played', v_ai_was_used
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 5. Permissions
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.rps_player_reconnect(uuid) TO authenticated;
-- rps_ai_takeover and rps_submit_move_v2 already have grants from v2 migration
