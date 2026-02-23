CREATE OR REPLACE FUNCTION next_tod_turn(lobby_uuid UUID)
RETURNS VOID AS $$
DECLARE
  next_target_id UUID;
  next_asker_id UUID;
  prev_target_id UUID;
BEGIN
  -- 1. Get the current target (to make them the next asker)
  SELECT current_target_id INTO prev_target_id FROM tod_lobbies WHERE id = lobby_uuid;

  -- 2. Mark the previous target as "gone"
  IF prev_target_id IS NOT NULL THEN
    UPDATE tod_participants 
    SET has_gone_this_round = true 
    WHERE lobby_id = lobby_uuid AND user_id = prev_target_id;
  END IF;

  -- 3. Check if everyone has gone (counting only 'joined' players)
  IF NOT EXISTS (
    SELECT 1 FROM tod_participants 
    WHERE lobby_id = lobby_uuid AND status = 'joined' AND has_gone_this_round = false
  ) THEN
    -- Reset cycle for 'joined' players
    UPDATE tod_participants 
    SET has_gone_this_round = false 
    WHERE lobby_id = lobby_uuid AND status = 'joined';
  END IF;

  -- 4. Set the new Asker (Previous Target becomes Asker if still joined, else host)
  IF EXISTS (SELECT 1 FROM tod_participants WHERE lobby_id = lobby_uuid AND user_id = prev_target_id AND status = 'joined') THEN
    next_asker_id := prev_target_id;
  ELSE
    next_asker_id := (SELECT host_id FROM tod_lobbies WHERE id = lobby_uuid);
  END IF;

  -- 5. Pick a random target who hasn't gone yet
  -- (Excluding the next_asker_id so the same person isn't both asker and target)
  SELECT user_id INTO next_target_id
  FROM tod_participants
  WHERE lobby_id = lobby_uuid 
    AND status = 'joined'
    AND has_gone_this_round = false 
    AND user_id != next_asker_id
  ORDER BY RANDOM()
  LIMIT 1;

  -- Fallback if only 1 person is left who hasn't gone (and they are the asker)
  -- Or if logic above fails to find a target
  IF next_target_id IS NULL THEN
    SELECT user_id INTO next_target_id 
    FROM tod_participants 
    WHERE lobby_id = lobby_uuid 
      AND status = 'joined'
      AND has_gone_this_round = false 
    LIMIT 1;
  END IF;

  -- Final fallback if somehow still null (shouldn't happen if there are joined players)
  IF next_target_id IS NULL THEN
    SELECT user_id INTO next_target_id 
    FROM tod_participants 
    WHERE lobby_id = lobby_uuid 
      AND status = 'joined'
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  -- 6. Update the Lobby
  UPDATE tod_lobbies
  SET 
    status = 'active',
    current_asker_id = next_asker_id,
    current_target_id = next_target_id,
    selected_mode = NULL,
    current_question = NULL,
    turn_started_at = NOW()
  WHERE id = lobby_uuid;

END;
$$ LANGUAGE plpgsql;
