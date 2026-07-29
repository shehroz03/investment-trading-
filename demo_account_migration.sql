-- Add demo balance columns to wallets table
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS demo_available NUMERIC DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS demo_locked NUMERIC DEFAULT 0.00;

-- Give existing users the $1000 demo balance
UPDATE public.wallets
SET demo_available = 1000.00
WHERE demo_available IS NULL OR demo_available = 0.00;

-- Add is_demo column to trades table
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
