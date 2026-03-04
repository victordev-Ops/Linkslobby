-- ============================================
-- Subscriptions table for Pro plan management
-- ============================================

CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paystack')),
  provider_subscription_id TEXT NOT NULL,
  provider_customer_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('weekly', 'monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'expired', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_subscription_id)
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_provider_sub_id ON public.subscriptions(provider_subscription_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (webhooks) can insert/update/delete
CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Function: sync_pro_status
-- Updates profiles.is_pro based on active subscriptions
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_pro_status(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_active BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = target_user_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  ) INTO has_active;

  UPDATE public.profiles
  SET is_pro = has_active, updated_at = now()
  WHERE id = target_user_id;
END;
$$;
