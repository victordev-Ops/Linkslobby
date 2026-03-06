-- Run this script in the Supabase SQL Editor to implement or fix the XP functions.
-- This guarantees the stars actually record to the xp_transactions table when you earn or spend them in the RPS game.

-- Drop the existing functions first to allow changing their return types
DROP FUNCTION IF EXISTS public.add_xp(uuid, integer, character varying, jsonb);
DROP FUNCTION IF EXISTS public.spend_xp(uuid, integer, character varying, jsonb);

CREATE OR REPLACE FUNCTION public.add_xp(
    p_user_id uuid,
    p_amount integer,
    p_reason character varying,
    p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance integer;
BEGIN
    -- Insert the transaction history
    INSERT INTO public.xp_transactions (user_id, amount, type, reason, metadata)
    VALUES (p_user_id, p_amount, 'earn', p_reason, p_metadata);

    -- Increase the user's total stars balance
    UPDATE public.profiles
    SET xp_balance = xp_balance + p_amount
    WHERE id = p_user_id
    RETURNING xp_balance INTO v_new_balance;

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.spend_xp(
    p_user_id uuid,
    p_amount integer,
    p_reason character varying,
    p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance integer;
    v_new_balance integer;
BEGIN
    -- Only deduct if the user actually has enough stars
    SELECT xp_balance INTO v_current_balance 
    FROM public.profiles 
    WHERE id = p_user_id;

    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User profile not found');
    END IF;

    IF v_current_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient stars');
    END IF;

    -- Insert the transaction history (note the 'spend' type)
    INSERT INTO public.xp_transactions (user_id, amount, type, reason, metadata)
    VALUES (p_user_id, p_amount, 'spend', p_reason, p_metadata);

    -- Decrease the user's total stars balance
    UPDATE public.profiles
    SET xp_balance = xp_balance - p_amount
    WHERE id = p_user_id
    RETURNING xp_balance INTO v_new_balance;

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Allow logged in users to execute these functions
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer, character varying, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_xp(uuid, integer, character varying, jsonb) TO authenticated;
