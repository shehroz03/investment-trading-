import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { TrendingUp, TrendingDown, Timer, AlertTriangle, Lock, Edit2, Loader2 } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useThemeClasses } from "@/app/components/Panel";
import {
  COIN_META,
  SIMULATED_COIN_META,
  subscribeToCryptoTicker,
  subscribeToSimulatedTicker,
  subscribeToAllTickers,
  type CryptoTick,
  type MarketTick,
} from "@/lib/crypto";
import {
  fetchKlines,
  subscribeToKline,
  fetchSimulatedKlines,
  subscribeToSimulatedKline,
  isSimulatedSymbol,
  INTERVAL_SECONDS,
} from "@/lib/klines";
import { openTrade, closeTrade, subscribeToOpenTrades, setDemoBalance, TRADE_DURATIONS, type Trade, type TradeDuration } from "@/lib/trading";
import { AllCoinsModal } from "@/app/components/AllCoinsModal";
import { TradingRulesModal } from "@/app/components/TradingRulesModal";

const INTERVALS = ["1m", "5m", "15m", "1h"];

// Real, disclosed window after a timed trade's duration ends: gives an admin a chance to set
// the outcome (see AdminTrades) before the trade auto-settles at the live/simulated price.
// The UI shows this honestly as "Settling..." — no hidden extension, no frozen screen.
const SETTLEMENT_GRACE_MS = 15000;

const DURATION_OPTIONS: { label: string; value: TradeDuration | null }[] = [
  { label: "Manual", value: null },
  { label: "10s", value: 10 },
  { label: "20s", value: 20 },
  { label: "30s", value: 30 },
  { label: "1min", value: 60 },
  { label: "2min", value: 120 },
  { label: "5min", value: 300 },
];

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function TradingPanel({ initialSymbol = "BTCUSDT", onSymbolChange }: { initialSymbol?: string, onSymbolChange?: (sym: string) => void }) {
  const { user, wallet, isDemo, setIsDemo } = useAuth();
  const { textPrimary, textMuted, cardBg, inputBg, divider, hoverBg, darkMode } = useThemeClasses();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const armedRef = useRef<Set<string>>(new Set());
  // Admin-decided outcome on an open BTS/ETC position: while set, the real simulated
  // price/kline feed for that symbol is suppressed (see the subscription effects below) and
  // the chart instead animates to a target price consistent with the win/loss %, then holds
  // there until the trade closes. Simulated instruments only — never real market symbols.
  const priceOverrideRef = useRef<{ tradeId: string; symbol: string; targetPrice: number } | null>(null);
  const overrideAnimatedRef = useRef<Set<string>>(new Set());

  const [symbol, setSymbol] = useState(initialSymbol);
  
  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);
  const [interval, setInterval_] = useState("1m");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState<TradeDuration | null>(null);
  const [submitting, setSubmitting] = useState<"long" | "short" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPositions, setOpenPositions] = useState<Trade[]>([]);
  const [ticks, setTicks] = useState<Record<string, CryptoTick>>({});
  const [closingId, setClosingId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  const [allTickers, setAllTickers] = useState<MarketTick[]>([]);
  const [settlingUntil, setSettlingUntil] = useState<Record<string, number>>({});
  // "info" = opened via the corner "Rules" link, just for viewing.
  // "long"/"short" = opened as a gate before that trade direction — accepting executes the trade.
  const [rulesModal, setRulesModal] = useState<"info" | "long" | "short" | null>(null);
  // Shown briefly right after a position closes — the trade's actual final P&L, not a preview.
  const [tradeResult, setTradeResult] = useState<{ trade: Trade; pnl: number } | null>(null);
  
  // Demo Balance Set state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoInput, setDemoInput] = useState("1000");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: darkMode ? "#94a3b8" : "#475569",
      },
      grid: {
        vertLines: { color: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        horzLines: { color: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
      },
      width: containerRef.current.clientWidth,
      height: 360,
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderVisible: false,
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    const simulated = isSimulatedSymbol(symbol);
    const load = simulated ? fetchSimulatedKlines(symbol, interval, 200) : fetchKlines(symbol, interval, 200);
    load.then((candles) => {
      if (cancelled || !seriesRef.current) return;
      seriesRef.current.setData(candles);
    });

    const subscribe = simulated ? subscribeToSimulatedKline : subscribeToKline;
    const unsubscribe = subscribe(symbol, interval, (candle) => {
      // Real feed stays suppressed for a symbol under an active admin-outcome override —
      // otherwise it would immediately overwrite the animated/held target price.
      if (priceOverrideRef.current?.symbol === symbol) return;
      seriesRef.current?.update(candle);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [symbol, interval]);

  useEffect(() => {
    const unsubscribe = subscribeToCryptoTicker((next) => setTicks((prev) => ({ ...prev, ...next })));
    const unsubscribeSimulated = subscribeToSimulatedTicker((next) => {
      const overriddenSymbol = priceOverrideRef.current?.symbol.toLowerCase();
      setTicks((prev) => {
        if (!overriddenSymbol || !(overriddenSymbol in next)) return { ...prev, ...next };
        // Don't let the real feed clobber the held override price for its symbol.
        const { [overriddenSymbol]: _dropped, ...rest } = next;
        return { ...prev, ...rest };
      });
    });
    return () => {
      unsubscribe();
      unsubscribeSimulated();
    };
  }, []);

  // Populates the coin dropdown with every live USDT market (short symbol only), not just
  // the pinned favorites — same data source AllCoinsModal already uses.
  useEffect(() => {
    const unsubscribe = subscribeToAllTickers(setAllTickers);
    return unsubscribe;
  }, []);

  const sortedTickers = useMemo(() => {
    // Ethereum Classic (and possibly BitShares) also exist as real Binance markets, which
    // would otherwise list "ETC"/"BTS" a second time alongside this app's own simulated
    // versions of them — exclude any live ticker whose symbol collides with a simulated one.
    const simulatedSymbols = new Set(Object.keys(SIMULATED_COIN_META).map((s) => s.toUpperCase()));
    return [...allTickers]
      .filter((t) => !simulatedSymbols.has(t.symbol))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);
  }, [allTickers]);
  const knownSymbols = useMemo(
    () =>
      new Set([
        ...sortedTickers.map((t) => t.symbol),
        ...Object.keys(COIN_META).map((s) => s.toUpperCase()),
        ...Object.keys(SIMULATED_COIN_META).map((s) => s.toUpperCase()),
      ]),
    [sortedTickers]
  );

  // Drives the countdown text on timed positions.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Live, not a one-time fetch: an admin setting adminOutcome or frozen on an already-loaded
  // position (from AdminTrades) needs to reach this panel immediately, not just on the next
  // manual reload — that's also what the price-override animation below keys off of.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToOpenTrades(user.id, setOpenPositions);
    return unsubscribe;
  }, [user]);

  const handleClose = async (tradeId: string) => {
    setClosingId(tradeId);
    const closedPosition = openPositions.find((p) => p.id === tradeId);
    try {
      const { pnl } = await closeTrade(tradeId);
      // Shows the trade's real, already-computed P&L — nothing fabricated or animated here,
      // just surfacing the actual result once the position settles.
      if (closedPosition) setTradeResult({ trade: closedPosition, pnl });
    } catch (err) {
      // Most commonly hit if an admin froze this trade between it being loaded and the
      // auto-close timer firing — the live subscription already reflects that either way.
      setError(err instanceof Error ? err.message : "Failed to close trade.");
    } finally {
      setClosingId((current) => (current === tradeId ? null : current));
      setSettlingUntil((prev) => {
        const next = { ...prev };
        delete next[tradeId];
        return next;
      });
    }
  };

  // Arm a one-shot auto-close timer for every timed position we haven't already scheduled —
  // covers both freshly opened trades and ones restored on reload. When the user's selected
  // duration elapses, the trade enters a disclosed "Settling..." grace period (see
  // SETTLEMENT_GRACE_MS) before it auto-closes, giving an admin a real window to set the
  // outcome — the countdown shown to the user is genuine, not a stall.
  useEffect(() => {
    for (const pos of openPositions) {
      if (!pos.expiresAt || pos.frozen || armedRef.current.has(pos.id)) continue;
      armedRef.current.add(pos.id);
      const msUntilExpiry = pos.expiresAt.toMillis() - Date.now();

      const beginSettlement = () => {
        setSettlingUntil((prev) => ({ ...prev, [pos.id]: Date.now() + SETTLEMENT_GRACE_MS }));
        setTimeout(() => handleClose(pos.id), SETTLEMENT_GRACE_MS);
      };

      if (msUntilExpiry <= 0) beginSettlement();
      else setTimeout(beginSettlement, msUntilExpiry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPositions]);

  // When an admin sets win/loss on an open BTS/ETC position, the chart for that symbol
  // animates from its current price to a target consistent with the payout tiers (30%/40%,
  // same as the actual money math in api/closeTrade.js), then holds there — purely a visual
  // reveal on this app's own simulated instruments, never on real market symbols. Resumes
  // normal simulated movement once the trade closes (priceOverrideRef clears below).
  useEffect(() => {
    const pos = openPositions.find(
      (p) => isSimulatedSymbol(p.symbol) && (p.adminOutcome === "win" || p.adminOutcome === "loss")
    );

    if (!pos) {
      priceOverrideRef.current = null;
      return;
    }

    const profitPercent = pos.amount > 1000 ? 0.4 : 0.3;
    const favorable = (pos.direction === "long") === (pos.adminOutcome === "win");
    const targetPrice = pos.entryPrice * (1 + (favorable ? 1 : -1) * profitPercent);
    priceOverrideRef.current = { tradeId: pos.id, symbol: pos.symbol, targetPrice };

    if (pos.symbol !== symbol || !seriesRef.current) return;
    const series = seriesRef.current;
    const stepSec = INTERVAL_SECONDS[interval] ?? 60;
    const bucketTime = Math.floor(Date.now() / (stepSec * 1000)) * stepSec;
    const lowerSymbol = pos.symbol.toLowerCase();

    if (overrideAnimatedRef.current.has(pos.id)) {
      // Already played out once (e.g. the user switched coins and back) — snap straight to
      // the held target instead of replaying the animation.
      series.update({ time: bucketTime as Time, open: targetPrice, high: targetPrice, low: targetPrice, close: targetPrice });
      return;
    }

    const startPrice = ticks[lowerSymbol]?.price ?? pos.entryPrice;
    const STEPS = 20;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      const t = Math.min(1, step / STEPS);
      const price = startPrice + (targetPrice - startPrice) * t;
      series.update({
        time: bucketTime as Time,
        open: startPrice,
        high: Math.max(startPrice, price),
        low: Math.min(startPrice, price),
        close: price,
      });
      setTicks((prev) => ({
        ...prev,
        [lowerSymbol]: { symbol: lowerSymbol, price, changePercent: ((price - startPrice) / startPrice) * 100 },
      }));
      if (t >= 1) {
        clearInterval(id);
        overrideAnimatedRef.current.add(pos.id);
      }
    }, 125);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPositions, symbol, interval]);

  const requestTrade = (direction: "long" | "short") => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    const currentBalance = isDemo ? (wallet?.demo_available ?? 0) : (wallet?.available ?? 0);
    if (wallet && numericAmount > currentBalance) {
      setError(`Amount exceeds your ${isDemo ? 'demo' : 'available'} balance.`);
      return;
    }
    setError(null);
    setRulesModal(direction);
  };

  const handleTrade = async (direction: "long" | "short") => {
    if (!user) return;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    const currentBalance = isDemo ? (wallet?.demo_available ?? 0) : (wallet?.available ?? 0);
    if (wallet && numericAmount > currentBalance) {
      setError(`Amount exceeds your ${isDemo ? 'demo' : 'available'} balance.`);
      return;
    }
    setError(null);
    setSubmitting(direction);
    try {
      await openTrade(symbol, direction, numericAmount, duration ?? undefined, isDemo);
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open trade.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSetDemo = async () => {
    const val = Number(demoInput);
    if (isNaN(val) || val < 1 || val > 500000) {
      setDemoError("Amount must be between $1 and $500,000.");
      return;
    }
    setDemoError(null);
    setDemoLoading(true);
    try {
      await setDemoBalance(val);
      setShowDemoModal(false);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Failed to set demo balance.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${cardBg}`}>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-3">
            <select
              value={symbol}
              onChange={(e) => {
                const sym = e.target.value;
                setSymbol(sym);
                onSymbolChange?.(sym);
              }}
              className={`px-3 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
            >
              {/* This app's own simulated instruments go first — otherwise they'd be buried
                  at the bottom of a 300+ live-market list and effectively invisible. */}
              {Object.keys(SIMULATED_COIN_META).map((sym) => (
                <option key={sym} value={sym.toUpperCase()}>
                  {sym.replace(/usdt$/, "").toUpperCase()}
                </option>
              ))}
              {sortedTickers.length > 0
                ? sortedTickers.map((t) => (
                    <option key={t.symbol} value={t.symbol}>
                      {t.base}
                    </option>
                  ))
                : Object.keys(COIN_META).map((sym) => (
                    <option key={sym} value={sym.toUpperCase()}>
                      {sym.replace(/usdt$/, "").toUpperCase()}
                    </option>
                  ))}
              {!knownSymbols.has(symbol) && <option value={symbol}>{symbol.replace(/USDT$/, "")}</option>}
            </select>
            <button
              onClick={() => setShowCoinPicker(true)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${hoverBg} ${textMuted}`}
            >
              More coins...
            </button>
            {showCoinPicker && (
              <AllCoinsModal
                onClose={() => setShowCoinPicker(false)}
                onSelect={(sym) => {
                  setSymbol(sym);
                  onSymbolChange?.(sym);
                  setShowCoinPicker(false);
                }}
              />
            )}
            <div className="flex gap-1">
              {INTERVALS.map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval_(iv)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    interval === iv ? "bg-violet-500/20 text-violet-400" : `${hoverBg} ${textMuted}`
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRulesModal("info")}
              className={`ml-auto flex items-center gap-1 text-xs font-medium ${textMuted} hover:text-amber-400`}
            >
              <AlertTriangle size={13} />
              Rules
            </button>
            {rulesModal && (
              <TradingRulesModal
                onClose={() => setRulesModal(null)}
                onAccept={() => {
                  if (rulesModal === "long" || rulesModal === "short") handleTrade(rulesModal);
                }}
              />
            )}
          </div>
          <div ref={containerRef} className="w-full" />

          {tradeResult && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
              onClick={() => setTradeResult(null)}
            >
              <div
                className={`w-full max-w-xs rounded-2xl border p-6 text-center ${cardBg}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center ${
                    tradeResult.pnl >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {tradeResult.pnl >= 0 ? <TrendingUp size={26} /> : <TrendingDown size={26} />}
                </div>
                <p className={`font-semibold ${tradeResult.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Trade {tradeResult.pnl >= 0 ? "Won" : "Lost"}
                </p>
                <p className={`text-xs mt-1 ${textMuted}`}>
                  {tradeResult.trade.direction === "long" ? "Long" : "Short"} {tradeResult.trade.symbol.replace("USDT", "")} — Stake $
                  {tradeResult.trade.amount.toFixed(2)}
                </p>
                <p className={`text-2xl font-bold mt-3 ${tradeResult.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {tradeResult.pnl >= 0 ? "+" : ""}${tradeResult.pnl.toFixed(2)}
                </p>
                <button
                  onClick={() => setTradeResult(null)}
                  className="w-full mt-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:w-72 flex-shrink-0 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className={`text-xs flex items-center gap-1.5 ${textMuted}`}>
                {isDemo ? "Demo" : "Available"}: ${(isDemo ? (wallet?.demo_available ?? 0) : (wallet?.available ?? 0)).toFixed(2)}
                {isDemo && (
                  <button onClick={() => setShowDemoModal(true)} className={`p-1 rounded-md hover:bg-sky-500/10 text-sky-400 transition-colors`}>
                    <Edit2 size={12} />
                  </button>
                )}
              </p>
              <button
                onClick={() => setIsDemo(!isDemo)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${isDemo ? 'border-sky-500/30 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'}`}
              >
                {isDemo ? "Switch to Real" : "Switch to Demo"}
              </button>
            </div>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Amount (USD)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 ${inputBg}`}
            />
          </div>

          <div>
            <p className={`text-xs mb-1.5 flex items-center gap-1 ${textMuted}`}>
              <Timer size={12} /> Trade duration
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setDuration(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    duration === opt.value ? "bg-violet-500/20 text-violet-400 border border-violet-500/30" : `${hoverBg} ${textMuted} border ${divider}`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {duration && (
              <p className={`text-xs mt-1.5 ${textMuted}`}>
                Position auto-closes {DURATION_OPTIONS.find((o) => o.value === duration)?.label} after opening, then
                settles within {SETTLEMENT_GRACE_MS / 1000}s.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => requestTrade("long")}
              disabled={submitting !== null}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              <TrendingUp size={15} /> {submitting === "long" ? "..." : "Buy / Long"}
            </button>
            <button
              onClick={() => requestTrade("short")}
              disabled={submitting !== null}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              <TrendingDown size={15} /> {submitting === "short" ? "..." : "Sell / Short"}
            </button>
          </div>

          <div className={`pt-3 border-t ${divider}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textMuted}`}>Open Positions</p>
            {openPositions.length === 0 ? (
              <p className={`text-xs ${textMuted}`}>No open positions.</p>
            ) : (
              <div className="space-y-2">
                {openPositions.map((pos) => {
                  const currentPrice = ticks[pos.symbol.toLowerCase()]?.price;
                  const livePnl = currentPrice
                    ? pos.amount *
                      (pos.direction === "long"
                        ? (currentPrice - pos.entryPrice) / pos.entryPrice
                        : (pos.entryPrice - currentPrice) / pos.entryPrice)
                    : null;
                  const positive = (livePnl ?? 0) >= 0;
                  const remainingMs = pos.expiresAt ? pos.expiresAt.toMillis() - Date.now() : null;
                  const settleAt = settlingUntil[pos.id];

                  return (
                    <div key={pos.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${divider}`}>
                      <div>
                        <p className={`text-xs font-semibold flex items-center gap-2 ${textPrimary}`}>
                          {pos.direction === "long" ? "Long" : "Short"} {pos.symbol.replace("USDT", "")} — ${pos.amount}
                          {pos.is_demo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 uppercase tracking-wider">Demo</span>}
                        </p>
                        <p className={`text-xs ${livePnl === null ? textMuted : positive ? "text-green-400" : "text-red-400"}`}>
                          {livePnl === null ? "—" : `${positive ? "+" : ""}$${livePnl.toFixed(2)}`}
                        </p>
                      </div>
                      {pos.frozen ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-sky-400" title="An admin has frozen this trade — it can't be closed until unfrozen.">
                          <Lock size={12} />
                          Frozen
                        </span>
                      ) : settleAt !== undefined ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                          <Timer size={12} className="animate-pulse" />
                          Settling... {formatRemaining(settleAt - Date.now())}
                        </span>
                      ) : remainingMs !== null ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                          <Timer size={12} />
                          {formatRemaining(remainingMs)}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleClose(pos.id)}
                          disabled={closingId === pos.id}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${hoverBg} ${textPrimary}`}
                        >
                          {closingId === pos.id ? "..." : "Close"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showDemoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={() => setShowDemoModal(false)}>
          <div className={`w-full max-w-sm rounded-2xl border p-5 ${cardBg}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`font-semibold mb-2 ${textPrimary}`}>Set Demo Balance</h3>
            <p className={`text-xs mb-4 ${textMuted}`}>
              Set your demo balance to practice trading. Limit is $1 to $500,000.
            </p>
            <input
              type="number"
              min="1"
              max="500000"
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
              className={`w-full px-3 py-2.5 mb-2 rounded-xl border text-sm outline-none focus:border-sky-500 ${inputBg}`}
              placeholder="Amount (e.g. 1000)"
            />
            {demoError && <p className="text-xs text-red-400 mb-3">{demoError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowDemoModal(false)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${hoverBg} ${textPrimary}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSetDemo}
                disabled={demoLoading}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {demoLoading ? <Loader2 size={16} className="animate-spin" /> : "Set Balance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
