-- Add streak tracking and bonus activation to profiles table

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS login_streak_days INT DEFAULT 0;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bonus_2x_started_at TIMESTAMP WITH TIME ZONE;

-- Update the daily login RPC to track streaks and activate the bonus
CREATE OR REPLACE FUNCTION claim_daily_login_xp(
  p_user_id UUID,
  p_today DATE,
  p_amount INT,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_last_reward DATE;
  v_new_balance INT;
  v_current_streak INT;
  v_bonus_start TIMESTAMP WITH TIME ZONE;
  v_bonus_activated_today BOOLEAN := false;
BEGIN
  -- Get current reward date, streak, and bonus state and lock for update
  SELECT last_login_reward_at, login_streak_days, bonus_2x_started_at 
  INTO v_last_reward, v_current_streak, v_bonus_start
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Verify if already claimed today
  IF v_last_reward IS NOT NULL AND v_last_reward >= p_today THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already claimed today');
  END IF;

  -- Calculate new streak
  IF v_last_reward IS NULL OR v_last_reward < (p_today - INTERVAL '1 day')::DATE THEN
    -- Streak broken or first login
    v_current_streak := 1;
  ELSE
    -- Consecutive login
    v_current_streak := coalesce(v_current_streak, 0) + 1;
  END IF;

  -- Check if they hit a 7-day streak
  IF v_current_streak = 7 THEN
    -- If bonus is already active and valid, we could add time, but rule says activate on 7 days.
    -- Let's just set the start date to now. They get 7 days from today.
    v_bonus_start := now();
    v_bonus_activated_today := true;
    
    -- Reset streak so they can earn it again? Yes, reset to 0 so next login is day 1 of next streak
    v_current_streak := 0;
  END IF;

  -- Update profile: increment XP, set reward date, new streak, and potentially new bonus start
  UPDATE profiles
  SET xp_balance = xp_balance + p_amount,
      last_login_reward_at = p_today,
      login_streak_days = v_current_streak,
      bonus_2x_started_at = v_bonus_start
  WHERE id = p_user_id
  RETURNING xp_balance INTO v_new_balance;

  -- Log the transaction in xp_transactions
  INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
  VALUES (
    p_user_id, 
    p_amount, 
    'earn', 
    p_reason, 
    jsonb_build_object('type', 'daily_login', 'date', p_today, 'streak', coalesce(v_current_streak, coalesce(login_streak_days, 1)))
  );

  RETURN jsonb_build_object(
    'success', true, 
    'amount', p_amount, 
    'new_balance', v_new_balance,
    'new_streak', v_current_streak,
    'bonus_activated', v_bonus_activated_today,
    'message', 'Daily login reward claimed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
