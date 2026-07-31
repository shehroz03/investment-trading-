-- Migration: Add Stop Loss / Take Profit support to trades table
-- Created: 2026-07-31

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS "stopLoss" NUMERIC,
  ADD COLUMN IF NOT EXISTS "takeProfit" NUMERIC,
  ADD COLUMN IF NOT EXISTS "closeReason" TEXT;

COMMENT ON COLUMN public.trades."stopLoss" IS 'Long: auto-closes when price falls to/below this. Short: auto-closes when price rises to/above this.';
COMMENT ON COLUMN public.trades."takeProfit" IS 'Long: auto-closes when price rises to/above this. Short: auto-closes when price falls to/below this.';
COMMENT ON COLUMN public.trades."closeReason" IS 'manual | duration | stop_loss | take_profit. Display-only, not used in PnL math.';
