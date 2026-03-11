-- Migration: Auto-create a skeleton profile row when a new auth user signs up.
-- This prevents orphaned auth.users rows that have no corresponding profiles entry.

-- 1. Make slug nullable initially so skeleton profiles can be created
--    (The app logic handles redirection if slug is missing)
ALTER TABLE public.profiles ALTER COLUMN slug DROP NOT NULL;

-- 2. Create the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger (dropping if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill: create profile rows for any existing auth users that are missing one
INSERT INTO public.profiles (id, email, created_at, updated_at)
SELECT id, email, NOW(), NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
