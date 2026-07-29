-- ====================================================================
-- SUPABASE MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor to create tables and policies
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLES
-- ==========================================

CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  username TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  kyc_status TEXT DEFAULT 'none',
  vip_status TEXT DEFAULT 'none',
  credit_score INTEGER DEFAULT 50,
  profile_completion_percent INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.wallets (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  available NUMERIC DEFAULT 0,
  locked NUMERIC DEFAULT 0,
  pending NUMERIC DEFAULT 0,
  "pendingOrder" NUMERIC DEFAULT 0,
  "unlockTarget" NUMERIC,
  "firstTradePlaced" BOOLEAN DEFAULT false,
  "totalDeposits" NUMERIC DEFAULT 0,
  "totalWithdrawals" NUMERIC DEFAULT 0,
  "totalEarnings" NUMERIC DEFAULT 0,
  "lastInterestAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC,
  method TEXT,
  "proofUrl" TEXT,
  purpose TEXT,
  plan TEXT,
  status TEXT DEFAULT 'pending',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  "reviewedBy" TEXT
);

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC,
  method TEXT,
  destination TEXT,
  status TEXT DEFAULT 'pending',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  "reviewedBy" TEXT
);

CREATE TABLE public.kyc (
  uid UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  "personalInfo" JSONB,
  "idProofUrl" TEXT,
  "addressProofUrl" TEXT,
  "selfieUrl" TEXT,
  status TEXT DEFAULT 'pending',
  "submittedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.vip (
  uid UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  note TEXT,
  status TEXT DEFAULT 'pending',
  "submittedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT,
  amount NUMERIC,
  "dailyRoiPercent" NUMERIC,
  status TEXT,
  "startDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  symbol TEXT,
  direction TEXT,
  amount NUMERIC,
  "entryPrice" NUMERIC,
  status TEXT DEFAULT 'open',
  "closePrice" NUMERIC,
  pnl NUMERIC,
  "durationSeconds" INTEGER,
  "expiresAt" TIMESTAMP WITH TIME ZONE,
  "openedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "closedAt" TIMESTAMP WITH TIME ZONE,
  "adminOutcome" TEXT,
  "adminOutcomeBy" TEXT,
  "adminOutcomeAt" TIMESTAMP WITH TIME ZONE,
  frozen BOOLEAN DEFAULT false,
  "frozenBy" TEXT,
  "frozenAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT,
  amount NUMERIC,
  note TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.config (
  doc TEXT PRIMARY KEY,
  data JSONB
);

CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  content TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Helper function to check if the user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- users policies
CREATE POLICY "Users can view their own profile or admins can view all" ON public.users 
  FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Admins can update users" ON public.users 
  FOR UPDATE USING (public.is_admin());

-- wallets policies
CREATE POLICY "Users can view their own wallet or admins can view all" ON public.wallets 
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
-- Updates to wallets are strictly handled by secure Vercel API functions or Admin, no direct client update

-- deposits policies
CREATE POLICY "Users view own deposits, admins view all" ON public.deposits 
  FOR SELECT USING (auth.uid() = uid OR public.is_admin());
CREATE POLICY "Users can create pending deposits" ON public.deposits 
  FOR INSERT WITH CHECK (auth.uid() = uid AND status = 'pending');
CREATE POLICY "Admins can update deposits" ON public.deposits 
  FOR UPDATE USING (public.is_admin());

-- withdrawals policies
CREATE POLICY "Users view own withdrawals, admins view all" ON public.withdrawals 
  FOR SELECT USING (auth.uid() = uid OR public.is_admin());
CREATE POLICY "Admins can update withdrawals" ON public.withdrawals 
  FOR UPDATE USING (public.is_admin());

-- kyc policies
CREATE POLICY "Users view own kyc, admins view all" ON public.kyc 
  FOR SELECT USING (auth.uid() = uid OR public.is_admin());
CREATE POLICY "Users can submit kyc" ON public.kyc 
  FOR INSERT WITH CHECK (auth.uid() = uid AND status = 'pending');
CREATE POLICY "Admins can update kyc" ON public.kyc 
  FOR UPDATE USING (public.is_admin());

-- vip policies
CREATE POLICY "Users view own vip, admins view all" ON public.vip 
  FOR SELECT USING (auth.uid() = uid OR public.is_admin());
CREATE POLICY "Users can submit vip" ON public.vip 
  FOR INSERT WITH CHECK (auth.uid() = uid AND status = 'pending');
CREATE POLICY "Admins can update vip" ON public.vip 
  FOR UPDATE USING (public.is_admin());

-- trades policies
CREATE POLICY "Users view own trades, admins view all" ON public.trades 
  FOR SELECT USING (auth.uid() = uid OR public.is_admin());
-- Trades are inserted/updated via Vercel API only

-- transactions policies
CREATE POLICY "Users view own transactions, admins view all" ON public.transactions 
  FOR SELECT USING (auth.uid() = uid OR public.is_admin());
-- Transactions are inserted via Vercel API only

-- config policies
CREATE POLICY "Anyone can read config" ON public.config 
  FOR SELECT USING (auth.role() = 'authenticated');

-- news policies
CREATE POLICY "Anyone can read news" ON public.news 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage news" ON public.news 
  FOR ALL USING (public.is_admin());

-- Allow users to insert their own profile on signup
CREATE POLICY "Users can insert their own profile" ON public.users 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile (Settings page)
CREATE POLICY "Users can update their own profile" ON public.users 
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own wallet on signup
CREATE POLICY "Users can insert their own wallet" ON public.wallets 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
