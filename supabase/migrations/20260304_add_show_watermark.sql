-- Migration: Add show_watermark column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_watermark BOOLEAN DEFAULT TRUE;
