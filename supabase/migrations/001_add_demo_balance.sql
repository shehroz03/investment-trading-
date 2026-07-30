-- Migration: Add demo balance support to wallets and trades tables
-- Created: 2026-07-30

-- Add demo balance columns to wallets table
ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS demo_available NUMERIC DEFAULT 500000.00,
ADD COLUMN IF NOT EXISTS demo_locked NUMERIC DEFAULT 0.00;

-- Give existing users the $500,000 demo balance
UPDATE public.wallets
SET demo_available = 500000.00
WHERE demo_available IS NULL OR demo_available = 0.00;

-- Add is_demo column to trades table to track which trades are using demo balance
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on demo trades
CREATE INDEX IF NOT EXISTS idx_trades_is_demo ON public.trades(is_demo);
