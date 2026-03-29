-- =====================================================================
-- RPS Game System Fixes — AI Takeover & Solo Completion
-- =====================================================================

-- ─── 0) Add last_move columns so clients can see what was played ───
ALTER TABLE public.rps_matches ADD COLUMN IF NOT EXISTS last_move_a text;
ALTER TABLE public.rps_matches ADD COLUMN IF NOT EXISTS last_move_b text;
ALTER TABLE public.rps_matches ADD COLUMN IF NOT EXISTS last_round_result text;

-- ─── 1) rps_submit_move FIX ───
-- Fixes solo completion bug AND stores last moves before clearing.

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
  v_is_match_over boolean := false;
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
    v_is_match_over := true;
  ELSIF v_new_score_b >= v_win_target THEN
    v_match_winner := v_match.player_b;  -- Will be NULL in solo mode
    v_is_match_over := true;
  END IF;

  -- Update match state: save last moves, then clear current moves
  UPDATE rps_matches SET
    last_move_a = v_final_move_a,
    last_move_b = v_final_move_b,
    last_round_result = v_round_result,
    score_a = v_new_score_a,
    score_b = v_new_score_b,
    current_round = v_match.current_round + 1,
    move_a = NULL,
    move_b = NULL,
    round_started_at = CASE WHEN NOT v_is_match_over THEN now() ELSE round_started_at END,
    status = CASE WHEN v_is_match_over THEN 'completed' ELSE 'active' END,
    winner_id = v_match_winner,
    completed_at = CASE WHEN v_is_match_over THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_match_id;

  -- ═══ ESCROW DISTRIBUTION (on match completion) ═══
  IF v_is_match_over THEN
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
      IF v_match_winner IS NOT NULL THEN
        UPDATE profiles SET xp_balance = xp_balance + v_pool WHERE id = v_match_winner;
        INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
          VALUES (v_match_winner, v_pool, 'earn', '🏆 Won RPS match!',
            json_build_object('game', 'rps', 'match_id', p_match_id,
              'score', v_new_score_a || '-' || v_new_score_b)::jsonb);
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
    'current_round', v_match.current_round + 1
  );
END;
$$;


-- ─── 2) rps_convert_to_solo ───
-- New Helper RPC to convert an active match to solo when someone disconnects

CREATE OR REPLACE FUNCTION public.rps_convert_to_solo(p_match_id uuid, p_disconnected_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_match rps_matches%ROWTYPE;
  v_remaining_player uuid;
  v_new_score_a int;
  v_new_score_b int;
  v_new_move_a text;
  v_new_move_b text;
  v_new_escrow_a boolean;
BEGIN
  -- Lock match
  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- If it's not active or already solo, do nothing
  IF v_match.status != 'active' OR v_match.mode = 'solo' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not an active friend match');
  END IF;

  -- Ensure the disconnected player is actually in the match
  IF p_disconnected_user_id != v_match.player_a AND p_disconnected_user_id != v_match.player_b THEN
    RETURN json_build_object('success', false, 'error', 'User not in this match');
  END IF;

  v_remaining_player := CASE 
    WHEN p_disconnected_user_id = v_match.player_a THEN v_match.player_b 
    ELSE v_match.player_a 
  END;

  -- Swap players if A disconnected so that A is always the human
  IF p_disconnected_user_id = v_match.player_a THEN
    v_new_score_a := v_match.score_b;
    v_new_score_b := v_match.score_a;
    v_new_move_a  := v_match.move_b;
    v_new_move_b  := v_match.move_a;
    v_new_escrow_a := v_match.escrow_b;

    UPDATE rps_matches SET
      mode = 'solo',
      player_a = v_remaining_player,
      player_b = NULL,
      score_a = v_new_score_a,
      score_b = v_new_score_b,
      move_a = NULL,
      move_b = NULL,
      escrow_a = v_new_escrow_a,
      escrow_b = false,
      updated_at = now()
    WHERE id = p_match_id;
  ELSE
    -- If B disconnected, human is already A. Just remove B and set to solo.
    UPDATE rps_matches SET
      mode = 'solo',
      player_b = NULL,
      move_a = NULL,
      move_b = NULL,
      escrow_b = false,
      updated_at = now()
    WHERE id = p_match_id;
  END IF;

  -- Add persistent notification to the remaining player via an XP transaction (amount 0)
  INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
    VALUES (v_remaining_player, 0, 'earn', '🤖 Opponent left RPS Match. AI taking over!',
      json_build_object('game', 'rps', 'match_id', p_match_id, 'action', 'ai_takeover')::jsonb);

  RETURN json_build_object(
    'success', true, 
    'action', 'converted_to_solo', 
    'remaining_player_id', v_remaining_player
  );
END;
$$;

-- ─── 3) rps_cancel_match FIX ───
-- Active matches are now converted to solo instead of completing and awarding everything instantly.

CREATE OR REPLACE FUNCTION public.rps_cancel_match(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match rps_matches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id LIMIT 1;

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
    -- Lock row
    SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

    UPDATE profiles SET xp_balance = xp_balance + v_match.stake_amount
      WHERE id = v_match.player_a;
    INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
      VALUES (v_match.player_a, v_match.stake_amount, 'earn', '↩️ RPS match cancelled (refund)',
        json_build_object('game', 'rps', 'match_id', p_match_id, 'action', 'refund')::jsonb);

    UPDATE rps_matches SET status = 'cancelled', updated_at = now(), completed_at = now()
      WHERE id = p_match_id;

    RETURN json_build_object('success', true, 'action', 'refunded');
  END IF;

  -- ─── ACTIVE ───
  IF v_match.mode = 'solo' THEN
    -- Lock row
    SELECT * INTO v_match FROM rps_matches WHERE id = p_match_id FOR UPDATE;

    -- Solo forfeit: stake already gone, just mark completed
    UPDATE rps_matches SET
      status = 'completed',
      winner_id = NULL,  -- no winner on forfeit vs computer
      completed_at = now(),
      updated_at = now()
    WHERE id = p_match_id;

    RETURN json_build_object('success', true, 'action', 'forfeited_solo');
  END IF;

  -- Friend mode: convert to solo
  RETURN public.rps_convert_to_solo(p_match_id, v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rps_convert_to_solo(uuid, uuid) TO authenticated;
