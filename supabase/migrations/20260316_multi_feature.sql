-- Multi-feature migration: Hot Seat rewards + Online status
-- Run this against your Supabase project

-- 1. Hot Seat: idempotency flag for asker rewards (prevents duplicate star credits)
ALTER TABLE public.hot_seat_questions ADD COLUMN IF NOT EXISTS rewarded boolean DEFAULT false;

-- 2. Online status: last_seen timestamp for efficient presence detection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone;
