import { collection, getDocs, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

const TRADING_API_URL = import.meta.env.VITE_TRADING_API_URL;

async function callTradingApi<T>(endpoint: string, body: unknown): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken();
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
  expiresAt?: Timestamp | null;
  openedAt: Timestamp | null;
  closedAt?: Timestamp | null;
  adminOutcome?: TradeOutcome | null;
  adminOutcomeBy?: string;
  adminOutcomeAt?: Timestamp | null;
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

export async function getOpenTrades(uid: string): Promise<Trade[]> {
  const snap = await getDocs(
    query(collection(db, "trades"), where("uid", "==", uid), where("status", "==", "open"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trade);
}

export async function getClosedTrades(uid: string): Promise<Trade[]> {
  const snap = await getDocs(
    query(collection(db, "trades"), where("uid", "==", uid), where("status", "==", "closed"), orderBy("closedAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trade);
}
