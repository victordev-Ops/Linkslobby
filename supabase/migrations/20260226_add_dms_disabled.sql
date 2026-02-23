-- Migration: Add dms_disabled to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dms_disabled BOOLEAN DEFAULT FALSE;
