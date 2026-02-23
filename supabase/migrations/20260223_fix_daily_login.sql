-- Migration to fix duplicate daily login rewards
-- Adds a column to profiles to track the last time a daily reward was claimed
-- And adds an atomic RPC to handle the claim process

-- 1. Add tracking column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_login_reward_at DATE;

-- 2. Create atomic claim function
CREATE OR REPLACE FUNCTION claim_daily_login_xp(
  p_user_id UUID,
  p_today DATE,
  p_amount INT,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_last_reward DATE;
  v_new_balance INT;
BEGIN
  -- Get current reward date and lock for update
  SELECT last_login_reward_at INTO v_last_reward
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Verify if already claimed today
  IF v_last_reward IS NOT NULL AND v_last_reward >= p_today THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already claimed today');
  END IF;

  -- Update profile: increment XP and set reward date
  UPDATE profiles
  SET xp_balance = xp_balance + p_amount,
      last_login_reward_at = p_today
  WHERE id = p_user_id
  RETURNING xp_balance INTO v_new_balance;

  -- Log the transaction in xp_transactions
  INSERT INTO xp_transactions (user_id, amount, type, reason, metadata)
  VALUES (p_user_id, p_amount, 'earn', p_reason, jsonb_build_object('type', 'daily_login', 'date', p_today));

  RETURN jsonb_build_object(
    'success', true, 
    'amount', p_amount, 
    'new_balance', v_new_balance,
    'message', 'Daily login reward claimed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
