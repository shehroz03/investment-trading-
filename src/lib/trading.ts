import { supabase } from "@/lib/supabase";

const TRADING_API_URL = import.meta.env.VITE_TRADING_API_URL;

// Shared by every module that calls one of this project's Vercel serverless functions
export async function callTradingApi<T>(endpoint: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const idToken = session?.access_token;
  if (!idToken) throw new Error("Sign in required.");

  const res = await fetch(`${TRADING_API_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

export type TradeDirection = "long" | "short";

export const TRADE_DURATIONS = [10, 20, 30, 60, 120, 300] as const;
export type TradeDuration = (typeof TRADE_DURATIONS)[number];

export type TradeOutcome = "win" | "loss";

export interface Trade {
  id: string;
  uid: string;
  symbol: string;
  direction: TradeDirection;
  amount: number;
  entryPrice: number;
  status: "open" | "closed";
  closePrice?: number;
  pnl?: number;
  durationSeconds?: TradeDuration | null;
  expiresAt?: string | null;
  openedAt: string | null;
  closedAt?: string | null;
  adminOutcome?: TradeOutcome | null;
  adminOutcomeBy?: string;
  adminOutcomeAt?: string | null;
  frozen?: boolean;
  frozenBy?: string;
  frozenAt?: string | null;
}

export async function openTrade(
  symbol: string,
  direction: TradeDirection,
  amount: number,
  durationSeconds?: TradeDuration
) {
  return callTradingApi<{ tradeId: string; entryPrice: number }>("openTrade", {
    symbol,
    direction,
    amount,
    durationSeconds,
  });
}

export async function closeTrade(tradeId: string) {
  return callTradingApi<{ closePrice: number; pnl: number }>("closeTrade", { tradeId });
}

export async function setTradeOutcome(tradeId: string, outcome: TradeOutcome) {
  return callTradingApi<{ ok: boolean }>("setTradeOutcome", { tradeId, outcome });
}

export async function setTradeFrozen(tradeId: string, frozen: boolean) {
  return callTradingApi<{ ok: boolean }>("setTradeFrozen", { tradeId, frozen });
}

export async function accrueLockedInterest() {
  return callTradingApi<{ ok: boolean }>("accrueInterest", {});
}

export async function getOpenTrades(uid: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('uid', uid)
    .eq('status', 'open');
  if (error) throw error;
  return data as Trade[];
}

export function subscribeToOpenTrades(uid: string, onUpdate: (trades: Trade[]) => void): () => void {
  // Initial fetch
  getOpenTrades(uid).then(onUpdate).catch(console.error);

  const channel = supabase
    .channel('public:trades')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trades', filter: `uid=eq.${uid}` },
      () => {
        // Simple strategy: refetch on any change to this user's trades
        getOpenTrades(uid).then(onUpdate).catch(console.error);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getClosedTrades(uid: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('uid', uid)
    .eq('status', 'closed')
    .order('closedAt', { ascending: false });
  if (error) throw error;
  return data as Trade[];
}
