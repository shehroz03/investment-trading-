-- Migration: Enable Supabase Realtime on tables the app subscribes to
-- Created: 2026-07-31
--
-- Without this, postgres_changes subscriptions (used by AuthContext.tsx for live
-- profile/wallet updates, and trading.ts's subscribeToOpenTrades for live trade
-- updates) silently never fire — the UI only reflects a fresh page load/reload,
-- not live changes made by this user's own actions (e.g. editing SL/TP) or by an
-- admin (freezing a trade, approving a deposit).
--
-- Safe to run even if a table is already added — ADD TABLE fails loudly only if
-- run twice in the same transaction on some Postgres versions, so each is wrapped
-- to skip silently if already present.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;
