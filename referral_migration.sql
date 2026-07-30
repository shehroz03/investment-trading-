-- ====================================================================
-- REFERRAL SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor
-- ====================================================================

-- 1. Add referral columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- 2. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_uid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  referred_uid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  commission_percent NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'signup',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS on referrals table
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_uid OR public.is_admin());

CREATE POLICY "Allow referral insert on signup"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_uid);

CREATE POLICY "Admins can manage referrals"
  ON public.referrals FOR ALL
  USING (public.is_admin());

-- 4. Generate unique referral codes for existing users who don't have one
UPDATE public.users
SET referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE referral_code IS NULL;

-- 5. Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_uid);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_uid);
