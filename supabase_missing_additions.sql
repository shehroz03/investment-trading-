-- ====================================================================
-- MISSING ADDITIONS v2 — Safe to re-run (handles already-existing objects)
-- Run this in Supabase SQL Editor
-- ====================================================================

-- ==========================================
-- 1. REFERRAL COLUMNS ON USERS TABLE
-- ==========================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

UPDATE public.users
SET referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE referral_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);

-- ==========================================
-- 2. REFERRALS TABLE + POLICIES
-- ==========================================
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

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;
CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_uid OR public.is_admin());

DROP POLICY IF EXISTS "Allow referral insert on signup" ON public.referrals;
CREATE POLICY "Allow referral insert on signup"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_uid);

DROP POLICY IF EXISTS "Admins can manage referrals" ON public.referrals;
CREATE POLICY "Admins can manage referrals"
  ON public.referrals FOR ALL
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_uid);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_uid);

-- ==========================================
-- 3. GUIDES TABLE + POLICIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.guides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read guides" ON public.guides;
CREATE POLICY "Authenticated users can read guides"
  ON public.guides FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage guides" ON public.guides;
CREATE POLICY "Admins can manage guides"
  ON public.guides FOR ALL
  USING (public.is_admin());

-- ==========================================
-- 4. BANNERS TABLE + POLICIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read banners" ON public.banners;
CREATE POLICY "Authenticated users can read banners"
  ON public.banners FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
CREATE POLICY "Admins can manage banners"
  ON public.banners FOR ALL
  USING (public.is_admin());

-- ==========================================
-- 5. reviewedAt COLUMN ON VIP TABLE
-- ==========================================
ALTER TABLE public.vip
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- 6. DEMO BALANCE — $5,000,000 default
-- ==========================================
ALTER TABLE public.wallets
  ALTER COLUMN demo_available SET DEFAULT 5000000.00;

UPDATE public.wallets
SET demo_available = 5000000.00
WHERE demo_available <= 1000.00;
