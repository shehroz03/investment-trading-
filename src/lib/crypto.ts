export interface CryptoTick {
  symbol: string;
  price: number;
  changePercent: number;
}

export const COIN_META: Record<string, { label: string; icon: string }> = {
  btcusdt: { label: "Bitcoin", icon: "₿" },
  ethusdt: { label: "Ethereum", icon: "Ξ" },
  bnbusdt: { label: "BNB", icon: "B" },
  solusdt: { label: "Solana", icon: "S" },
  xrpusdt: { label: "XRP", icon: "X" },
  dogeusdt: { label: "Dogecoin", icon: "Ð" },
};

const SYMBOLS = Object.keys(COIN_META);

// Simulated coins: not on Binance, so prices are generated from a deterministic
// formula (time -> price) instead of a live feed. Being a pure function of time
// means the client ticker/chart and the trading Cloud Function (which independently
// re-implements this same formula in functions/index.js) always agree on "the price
// right now" without any shared state.
export const SIMULATED_COIN_META: Record<string, { label: string; icon: string }> = {
  btsusdt: { label: "BitShares", icon: "B" },
  etcusdt: { label: "Ethereum Classic", icon: "E" },
};

export const SIMULATED_RANGES: Record<string, [number, number]> = {
  btsusdt: [3, 7],
  etcusdt: [5, 9],
};

function seedFromSymbol(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return h;
}

export function getSimulatedPrice(symbol: string, atMs: number): number {
  const [min, max] = SIMULATED_RANGES[symbol];
  const seed = seedFromSymbol(symbol);
  const phase1 = ((seed % 1000) / 1000) * Math.PI * 2;
  const phase2 = (((seed >> 3) % 1000) / 1000) * Math.PI * 2;
  const phase3 = (((seed >> 7) % 1000) / 1000) * Math.PI * 2;
  const t = atMs / 1000;
  // Coefficients sum to 1, so this stays within [-1, 1] and the price never leaves [min, max].
  const wave = 0.55 * Math.sin(t / 53 + phase1) + 0.3 * Math.sin(t / 19 + phase2) + 0.15 * Math.sin(t / 7 + phase3);
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  return mid + amp * wave;
}

export function subscribeToSimulatedTicker(
  onUpdate: (ticks: Record<string, CryptoTick>) => void,
  intervalMs = 3000
): () => void {
  const symbols = Object.keys(SIMULATED_COIN_META);

  function emit() {
    const now = Date.now();
    const state: Record<string, CryptoTick> = {};
    symbols.forEach((symbol) => {
      const price = getSimulatedPrice(symbol, now);
      const prevPrice = getSimulatedPrice(symbol, now - intervalMs);
      state[symbol] = { symbol, price, changePercent: ((price - prevPrice) / prevPrice) * 100 };
    });
    onUpdate(state);
  }

  emit();
  const timer = setInterval(emit, intervalMs);
  return () => clearInterval(timer);
}

export function subscribeToCryptoTicker(onUpdate: (ticks: Record<string, CryptoTick>) => void): () => void {
  let ws: WebSocket | null = null;
  let closedByUs = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const state: Record<string, CryptoTick> = {};

  function connect() {
    const streams = SYMBOLS.map((s) => `${s}@ticker`).join("/");
    ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const data = payload?.data;
      if (!data?.s) return;
      const symbol = (data.s as string).toLowerCase();
      state[symbol] = {
        symbol,
        price: parseFloat(data.c),
        changePercent: parseFloat(data.P),
      };
      onUpdate({ ...state });
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

export interface MarketTick {
  symbol: string;
  base: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

// Polls every USDT-quoted market at once. Binance also exposes a "!ticker@arr" all-market
// WebSocket stream, but it isn't reachable from every network — REST polling is more reliable
// for a modal that's browsed occasionally rather than watched continuously.
export function subscribeToAllTickers(onUpdate: (ticks: MarketTick[]) => void, intervalMs = 10000): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function poll() {
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
      const data: Record<string, unknown>[] = await res.json();
      if (cancelled) return;

      const ticks: MarketTick[] = data
        .filter((t) => typeof t.symbol === "string" && (t.symbol as string).endsWith("USDT"))
        .map((t) => {
          const symbol = t.symbol as string;
          return {
            symbol,
            base: symbol.slice(0, -4),
            price: parseFloat(t.lastPrice as string),
            changePercent: parseFloat(t.priceChangePercent as string),
            quoteVolume: parseFloat(t.quoteVolume as string),
          };
        });
      onUpdate(ticks);
    } catch {
      // Transient network hiccup — the next poll will retry.
    } finally {
      if (!cancelled) timer = setTimeout(poll, intervalMs);
    }
  }

  poll();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
