import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { TrendingUp, TrendingDown, Timer, AlertTriangle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useThemeClasses } from "@/app/components/Panel";
import {
  COIN_META,
  SIMULATED_COIN_META,
  subscribeToCryptoTicker,
  subscribeToSimulatedTicker,
  type CryptoTick,
} from "@/lib/crypto";
import { fetchKlines, subscribeToKline, fetchSimulatedKlines, subscribeToSimulatedKline, isSimulatedSymbol } from "@/lib/klines";
import { openTrade, closeTrade, getOpenTrades, TRADE_DURATIONS, type Trade, type TradeDuration } from "@/lib/trading";
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

export function TradingPanel() {
  const { user, wallet } = useAuth();
  const { textPrimary, textMuted, cardBg, inputBg, divider, hoverBg, darkMode } = useThemeClasses();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const armedRef = useRef<Set<string>>(new Set());

  const [symbol, setSymbol] = useState("BTCUSDT");
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
  const [settlingUntil, setSettlingUntil] = useState<Record<string, number>>({});
  // "info" = opened via the corner "Rules" link, just for viewing.
  // "long"/"short" = opened as a gate before that trade direction — accepting executes the trade.
  const [rulesModal, setRulesModal] = useState<"info" | "long" | "short" | null>(null);

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
      seriesRef.current?.update(candle);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [symbol, interval]);

  useEffect(() => {
    const unsubscribe = subscribeToCryptoTicker((next) => setTicks((prev) => ({ ...prev, ...next })));
    const unsubscribeSimulated = subscribeToSimulatedTicker((next) => setTicks((prev) => ({ ...prev, ...next })));
    return () => {
      unsubscribe();
      unsubscribeSimulated();
    };
  }, []);

  // Drives the countdown text on timed positions.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const loadPositions = () => {
    if (!user) return;
    getOpenTrades(user.uid).then(setOpenPositions);
  };

  useEffect(() => {
    loadPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleClose = async (tradeId: string) => {
    setClosingId(tradeId);
    try {
      await closeTrade(tradeId);
      loadPositions();
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
      if (!pos.expiresAt || armedRef.current.has(pos.id)) continue;
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

  const requestTrade = (direction: "long" | "short") => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (wallet && numericAmount > wallet.available) {
      setError("Amount exceeds your available balance.");
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
    if (wallet && numericAmount > wallet.available) {
      setError("Amount exceeds your available balance.");
      return;
    }
    setError(null);
    setSubmitting(direction);
    try {
      await openTrade(symbol, direction, numericAmount, duration ?? undefined);
      setAmount("");
      loadPositions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open trade.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${cardBg}`}>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-3">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
            >
              {Object.entries({ ...COIN_META, ...SIMULATED_COIN_META }).map(([sym, meta]) => (
                <option key={sym} value={sym.toUpperCase()}>
                  {meta.label}
                </option>
              ))}
              {!(symbol.toLowerCase() in { ...COIN_META, ...SIMULATED_COIN_META }) && (
                <option value={symbol}>{symbol.replace(/USDT$/, "")}</option>
              )}
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
                    interval === iv ? "bg-teal-500/20 text-teal-400" : `${hoverBg} ${textMuted}`
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
        </div>

        <div className="lg:w-72 flex-shrink-0 space-y-3">
          <div>
            <p className={`text-xs mb-1 ${textMuted}`}>Available: ${(wallet?.available ?? 0).toFixed(2)}</p>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Amount (USD)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
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
                    duration === opt.value ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : `${hoverBg} ${textMuted} border ${divider}`
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
                        <p className={`text-xs font-semibold ${textPrimary}`}>
                          {pos.direction === "long" ? "Long" : "Short"} {pos.symbol.replace("USDT", "")} — ${pos.amount}
                        </p>
                        <p className={`text-xs ${livePnl === null ? textMuted : positive ? "text-green-400" : "text-red-400"}`}>
                          {livePnl === null ? "—" : `${positive ? "+" : ""}$${livePnl.toFixed(2)}`}
                        </p>
                      </div>
                      {settleAt !== undefined ? (
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
    </div>
  );
}
