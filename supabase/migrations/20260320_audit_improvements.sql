-- ============================================
-- Comprehensive audit migration:
-- 1. Performance indexes for hot query paths
-- 2. Webhook idempotency table
-- 3. Reports table expansion
-- 4. Support tickets table
-- 5. Ads system tables
-- ============================================

-- ─── 1. PERFORMANCE INDEXES ──────────────────────────────────────

-- Chat messages: speeds up unread count queries (session + sender filter)
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_sender
  ON chat_messages(session_id, sender_id, created_at DESC);

-- Confessions: speeds up unread count (profile + is_read filter)
CREATE INDEX IF NOT EXISTS idx_confessions_profile_unread
  ON confessions(profile_id, is_read) WHERE is_read = false;

-- Friendships: speeds up friend lookups by user
CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee
  ON friendships(addressee_id, status);

-- XP transactions: speeds up unread notification count
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_unread
  ON xp_transactions(user_id, is_read) WHERE is_read = false;

-- Subscriptions: speeds up user status lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

-- DYKM scores: speeds up unread quiz result count
CREATE INDEX IF NOT EXISTS idx_dykm_scores_owner_unread
  ON dykm_scores(quiz_owner_id, is_read) WHERE is_read = false;

-- ─── 2. WEBHOOK IDEMPOTENCY ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id text PRIMARY KEY,                -- event ID from the provider
  provider text NOT NULL,             -- 'paystack' or 'stripe'
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
  ON webhook_events(provider, processed_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook events
CREATE POLICY "Service role manages webhook events"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 3. REPORTS TABLE EXPANSION ─────────────────────────────────
-- Add columns that the reportChatUser action expects

DO $$ BEGIN
  -- Add reported_user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'reported_user_id'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN reported_user_id uuid REFERENCES public.profiles(id);
  END IF;

  -- Add report_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'report_type'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN report_type text DEFAULT 'confession';
  END IF;

  -- Add context column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'context'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN context text;
  END IF;

  -- Add context_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'context_id'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN context_id text;
  END IF;

  -- Add status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN status text DEFAULT 'pending';
  END IF;

  -- Add admin_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN admin_notes text;
  END IF;

  -- Add resolved_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN resolved_at timestamptz;
  END IF;

  -- Make confession_id nullable (reports can be about users, not just confessions)
  -- This is safe: ALTER COLUMN ... DROP NOT NULL is idempotent if already nullable
  BEGIN
    ALTER TABLE public.reports ALTER COLUMN confession_id DROP NOT NULL;
  EXCEPTION WHEN others THEN
    NULL; -- Already nullable
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_status
  ON reports(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reports_reported_user
  ON reports(reported_user_id);

-- ─── 4. SUPPORT TICKETS TABLE ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  admin_reply text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status) WHERE status IN ('open', 'in_progress');

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own tickets
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all tickets
CREATE POLICY "Service role manages all tickets"
  ON support_tickets FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 5. ADS SYSTEM TABLES ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  target_url text NOT NULL,
  placement text NOT NULL
    CHECK (placement IN ('feed', 'sidebar', 'banner', 'interstitial')),
  is_active boolean DEFAULT true,
  priority int DEFAULT 0,
  impression_count int DEFAULT 0,
  click_count int DEFAULT 0,
  target_audience jsonb DEFAULT '{}',  -- e.g. {"is_pro": false, "min_xp": 0}
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_active_placement
  ON ads(placement, is_active, priority DESC)
  WHERE is_active = true;

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Anyone can view active ads
CREATE POLICY "Anyone can view active ads"
  ON ads FOR SELECT
  USING (is_active = true AND (start_date IS NULL OR start_date <= now())
         AND (end_date IS NULL OR end_date >= now()));

-- Service role manages ads
CREATE POLICY "Service role manages ads"
  ON ads FOR ALL
  USING (auth.role() = 'service_role');

-- Ad impressions tracking
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad
  ON ad_impressions(ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_user
  ON ad_impressions(user_id, ad_id, created_at DESC);

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can log impressions
CREATE POLICY "Users can log impressions"
  ON ad_impressions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all
CREATE POLICY "Service role reads all impressions"
  ON ad_impressions FOR ALL
  USING (auth.role() = 'service_role');
