import { SIMULATED_RANGES, getSimulatedPrice } from "@/lib/crypto";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function isSimulatedSymbol(symbol: string): boolean {
  return symbol.toLowerCase() in SIMULATED_RANGES;
}

export const INTERVAL_SECONDS: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600 };

function buildSimulatedCandle(symbol: string, bucketStartMs: number, stepMs: number): Candle {
  const samples = 5;
  const prices: number[] = [];
  for (let i = 0; i <= samples; i++) {
    prices.push(getSimulatedPrice(symbol, bucketStartMs + (i * stepMs) / samples));
  }
  return {
    time: Math.floor(bucketStartMs / 1000),
    open: prices[0],
    close: prices[prices.length - 1],
    high: Math.max(...prices),
    low: Math.min(...prices),
  };
}

export async function fetchSimulatedKlines(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
  const stepMs = (INTERVAL_SECONDS[interval] ?? 60) * 1000;
  const lowerSymbol = symbol.toLowerCase();
  const nowBucket = Math.floor(Date.now() / stepMs) * stepMs;
  const candles: Candle[] = [];
  for (let i = limit - 1; i >= 0; i--) {
    candles.push(buildSimulatedCandle(lowerSymbol, nowBucket - i * stepMs, stepMs));
  }
  return candles;
}

export function subscribeToSimulatedKline(
  symbol: string,
  interval: string,
  onUpdate: (candle: Candle, isFinal: boolean) => void
): () => void {
  const stepMs = (INTERVAL_SECONDS[interval] ?? 60) * 1000;
  const lowerSymbol = symbol.toLowerCase();
  let lastBucket = Math.floor(Date.now() / stepMs) * stepMs;

  function emit() {
    const now = Date.now();
    const bucket = Math.floor(now / stepMs) * stepMs;
    const isFinal = bucket !== lastBucket;
    lastBucket = bucket;
    const elapsed = Math.max(now - bucket, 1);
    onUpdate(buildSimulatedCandle(lowerSymbol, bucket, elapsed), isFinal);
  }

  emit();
  const timer = setInterval(emit, 1000);
  return () => clearInterval(timer);
}

export async function fetchKlines(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
  );
  const raw: unknown[][] = await res.json();
  return raw.map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }));
}

export function subscribeToKline(
  symbol: string,
  interval: string,
  onUpdate: (candle: Candle, isFinal: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let closedByUs = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const k = payload?.k;
      if (!k) return;
      onUpdate(
        {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        },
        k.x === true
      );
    };

    ws.onclose = () => {
      if (!closedByUs) reconnectTimer = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return () => {
    closedByUs = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
