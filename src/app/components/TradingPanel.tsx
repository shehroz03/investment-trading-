import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { TrendingUp, TrendingDown, Timer, AlertTriangle, Lock, Edit2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
import {
  openTrade,
  closeTrade,
  updateTradeSlTp,
  subscribeToOpenTrades,
  setDemoBalance,
  TRADE_DURATIONS,
  type Trade,
  type TradeDuration,
  type TradeCloseReason,
} from "@/lib/trading";
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

// Mirrors the direction-sanity check api/openTrade.js and api/updateTradeSlTp.js run
// server-side — this is just an early, friendlier rejection so the user doesn't have to
// round-trip to the server to find out their SL/TP is on the wrong side of the price.
function validateSlTp(direction: "long" | "short", referencePrice: number, sl: number | null, tp: number | null): string | null {
  if (direction === "long") {
    if (sl !== null && sl >= referencePrice) return "Stop loss must be below the current price for a Long.";
    if (tp !== null && tp <= referencePrice) return "Take profit must be above the current price for a Long.";
  } else {
    if (sl !== null && sl <= referencePrice) return "Stop loss must be above the current price for a Short.";
    if (tp !== null && tp >= referencePrice) return "Take profit must be below the current price for a Short.";
  }
  return null;
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
  // Arm-once guard for SL/TP auto-close, mirroring armedRef's role for duration auto-close —
  // without it, a single price crossing could fire handleClose multiple times while the
  // close request is still in flight (ticks update far more often than once).
  const slTpArmedRef = useRef<Set<string>>(new Set());
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const seriesMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  // Rolling, capped history of recent exit points (per symbol) so the chart can show where a
  // trade closed even though it's no longer in openPositions — not fetched from the DB, just
  // appended live as trades close during this session.
  const exitMarkersRef = useRef<SeriesMarker<Time>[]>([]);

  // Dashboard ticker links and Binance stream URLs use lowercase symbols (e.g.
  // /trade/btcusdt), but the trading API and the coin dropdown's <option> values are
  // uppercase — normalize once here so both always agree regardless of how the symbol
  // was set (URL param, dropdown, coin picker).
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());

  useEffect(() => {
    setSymbol(initialSymbol.toUpperCase());
  }, [initialSymbol]);
  const [interval, setInterval_] = useState("1m");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState<TradeDuration | null>(null);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [showSlTp, setShowSlTp] = useState(false);
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

  // Edit Stop Loss / Take Profit on an already-open position
  const [editingSlTp, setEditingSlTp] = useState<Trade | null>(null);
  const [editSl, setEditSl] = useState("");
  const [editTp, setEditTp] = useState("");
  const [editSlTpError, setEditSlTpError] = useState<string | null>(null);
  const [editSlTpSaving, setEditSlTpSaving] = useState(false);

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
    seriesMarkersRef.current = createSeriesMarkers(series, []);

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesMarkersRef.current = null;
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

  // Draws entry/SL/TP price lines for the currently selected symbol's open position(s) only —
  // lightweight-charts price lines are per-series, so a position on a different symbol than
  // the one currently shown isn't drawn here even though it's still open. Every line created
  // is tracked in priceLinesRef and removed before redrawing, so switching symbols or
  // positions opening/closing never leaks IPriceLine instances.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];

    const positionsForSymbol = openPositions.filter((p) => p.symbol === symbol);
    for (const pos of positionsForSymbol) {
      const directionColor = pos.direction === "long" ? "#22C55E" : "#EF4444";
      priceLinesRef.current.push(
        series.createPriceLine({
          price: pos.entryPrice,
          color: directionColor,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `Entry ${pos.direction === "long" ? "Long" : "Short"} $${pos.amount}`,
        })
      );
      if (pos.stopLoss != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: pos.stopLoss,
            color: "#EF4444",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "SL",
          })
        );
      }
      if (pos.takeProfit != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: pos.takeProfit,
            color: "#22C55E",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "TP",
          })
        );
      }
    }

    return () => {
      for (const line of priceLinesRef.current) series.removePriceLine(line);
      priceLinesRef.current = [];
    };
  }, [openPositions, symbol]);

  // Chart markers: an entry arrow for every currently open position on this symbol, plus a
  // rolling (capped) history of recent exit points appended live in handleClose below — no
  // extra DB fetch just to draw chart history.
  useEffect(() => {
    const markersApi = seriesMarkersRef.current;
    if (!markersApi) return;

    const stepSec = INTERVAL_SECONDS[interval] ?? 60;
    const toBarTime = (iso: string) => (Math.floor(new Date(iso).getTime() / (stepSec * 1000)) * stepSec) as Time;

    const entryMarkers: SeriesMarker<Time>[] = openPositions
      .filter((p) => p.symbol === symbol && p.openedAt)
      .map((p) => ({
        time: toBarTime(p.openedAt as string),
        position: p.direction === "long" ? "belowBar" : "aboveBar",
        shape: p.direction === "long" ? "arrowUp" : "arrowDown",
        color: p.direction === "long" ? "#22C55E" : "#EF4444",
        text: "Entry",
      }));

    const relevantExitMarkers = exitMarkersRef.current.filter((m) => m.id?.startsWith(`${symbol}:`));
    markersApi.setMarkers([...entryMarkers, ...relevantExitMarkers]);
  }, [openPositions, symbol, interval]);

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

  const handleClose = async (tradeId: string, reason?: TradeCloseReason) => {
    setClosingId(tradeId);
    const closedPosition = openPositions.find((p) => p.id === tradeId);
    try {
      const { pnl } = await closeTrade(tradeId, reason);
      // Shows the trade's real, already-computed P&L — nothing fabricated or animated here,
      // just surfacing the actual result once the position settles.
      if (closedPosition) {
        const stepSec = INTERVAL_SECONDS[interval] ?? 60;
        const barTime = (Math.floor(Date.now() / (stepSec * 1000)) * stepSec) as Time;
        exitMarkersRef.current = [
          ...exitMarkersRef.current.slice(-19), // cap rolling history
          {
            id: `${closedPosition.symbol}:${tradeId}`,
            time: barTime,
            position: "inBar",
            shape: "circle",
            color: pnl >= 0 ? "#22C55E" : "#EF4444",
            text: pnl >= 0 ? "Win" : "Loss",
          },
        ];
        setTradeResult({ trade: closedPosition, pnl });
      }
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
      const msUntilExpiry = new Date(pos.expiresAt).getTime() - Date.now();

      const beginSettlement = () => {
        setSettlingUntil((prev) => ({ ...prev, [pos.id]: Date.now() + SETTLEMENT_GRACE_MS }));
        setTimeout(() => handleClose(pos.id, "duration"), SETTLEMENT_GRACE_MS);
      };

      if (msUntilExpiry <= 0) beginSettlement();
      else setTimeout(beginSettlement, msUntilExpiry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPositions]);

  // Mirrors the arm-once pattern used for duration auto-close above (armedRef), but watches
  // live price crossing an SL/TP level instead of a fixed timer — must recheck on every
  // `ticks` update since a cross can happen at any time, not on a schedule. slTpArmedRef
  // prevents a single crossing from firing handleClose more than once while the close
  // request is in flight.
  useEffect(() => {
    for (const pos of openPositions) {
      if (pos.frozen || slTpArmedRef.current.has(pos.id)) continue;
      if (pos.stopLoss == null && pos.takeProfit == null) continue;
      const currentPrice = ticks[pos.symbol.toLowerCase()]?.price;
      if (currentPrice === undefined) continue;

      const hitStopLoss =
        pos.stopLoss != null &&
        (pos.direction === "long" ? currentPrice <= pos.stopLoss : currentPrice >= pos.stopLoss);
      const hitTakeProfit =
        pos.takeProfit != null &&
        (pos.direction === "long" ? currentPrice >= pos.takeProfit : currentPrice <= pos.takeProfit);

      if (hitStopLoss || hitTakeProfit) {
        slTpArmedRef.current.add(pos.id);
        handleClose(pos.id, hitStopLoss ? "stop_loss" : "take_profit");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticks, openPositions]);

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
    const referencePrice = ticks[symbol.toLowerCase()]?.price;
    const sl = stopLoss.trim() ? Number(stopLoss) : null;
    const tp = takeProfit.trim() ? Number(takeProfit) : null;
    if (referencePrice != null) {
      const slTpError = validateSlTp(direction, referencePrice, sl, tp);
      if (slTpError) {
        setError(slTpError);
        return;
      }
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
    const sl = stopLoss.trim() ? Number(stopLoss) : null;
    const tp = takeProfit.trim() ? Number(takeProfit) : null;
    const referencePrice = ticks[symbol.toLowerCase()]?.price;
    if (referencePrice != null) {
      const slTpError = validateSlTp(direction, referencePrice, sl, tp);
      if (slTpError) {
        setError(slTpError);
        return;
      }
    }
    setError(null);
    setSubmitting(direction);
    try {
      await openTrade(symbol, direction, numericAmount, duration ?? undefined, isDemo, sl ?? undefined, tp ?? undefined);
      setAmount("");
      setStopLoss("");
      setTakeProfit("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open trade.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSaveSlTp = async () => {
    if (!editingSlTp) return;
    const sl = editSl.trim() ? Number(editSl) : null;
    const tp = editTp.trim() ? Number(editTp) : null;
    const slTpError = validateSlTp(editingSlTp.direction, editingSlTp.entryPrice, sl, tp);
    if (slTpError) {
      setEditSlTpError(slTpError);
      return;
    }
    setEditSlTpError(null);
    setEditSlTpSaving(true);
    try {
      await updateTradeSlTp(editingSlTp.id, sl, tp);
      setEditingSlTp(null);
    } catch (err) {
      setEditSlTpError(err instanceof Error ? err.message : "Failed to update stop loss / take profit.");
    } finally {
      setEditSlTpSaving(false);
    }
  };

  const handleSetDemo = async () => {
    const val = Number(demoInput);
    if (isNaN(val) || val < 1 || val > 5000000) {
      setDemoError("Amount must be between $1 and $5,000,000.");
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

  const SPREAD_PERCENT = 0.0006; // 0.06% cosmetic display spread — not used for actual fills
  const midPrice = ticks[symbol.toLowerCase()]?.price;
  const bidPrice = midPrice != null ? midPrice * (1 - SPREAD_PERCENT / 2) : null;
  const askPrice = midPrice != null ? midPrice * (1 + SPREAD_PERCENT / 2) : null;

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
            {/* Cosmetic display spread — purely visual. The actual fill price used by
                openTrade/closeTrade stays the single server-fetched price exactly as
                before; bid/ask never feeds into the trade execution path. */}
            {midPrice != null && (
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-red-400">Bid {bidPrice!.toFixed(2)}</span>
                <span className="text-green-400">Ask {askPrice!.toFixed(2)}</span>
              </div>
            )}
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

          <div>
            <button
              type="button"
              onClick={() => setShowSlTp((v) => !v)}
              className={`w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider ${textMuted}`}
            >
              <span>Stop Loss / Take Profit</span>
              {showSlTp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showSlTp && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className={`text-[10px] ${textMuted}`}>Stop Loss</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className={`w-full px-2.5 py-2 rounded-lg border text-xs outline-none focus:border-red-500 ${inputBg}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] ${textMuted}`}>Take Profit</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className={`w-full px-2.5 py-2 rounded-lg border text-xs outline-none focus:border-green-500 ${inputBg}`}
                  />
                </div>
              </div>
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
                  const remainingMs = pos.expiresAt ? new Date(pos.expiresAt).getTime() - Date.now() : null;
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
                        {(pos.stopLoss != null || pos.takeProfit != null) && (
                          <p className="text-[10px] mt-0.5 flex gap-2">
                            {pos.stopLoss != null && <span className="text-red-400">SL ${pos.stopLoss}</span>}
                            {pos.takeProfit != null && <span className="text-green-400">TP ${pos.takeProfit}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!pos.frozen && (
                          <button
                            onClick={() => {
                              setEditingSlTp(pos);
                              setEditSl(pos.stopLoss?.toString() ?? "");
                              setEditTp(pos.takeProfit?.toString() ?? "");
                              setEditSlTpError(null);
                            }}
                            title="Edit Stop Loss / Take Profit"
                            className="p-1 rounded-md hover:bg-violet-500/10 text-violet-400"
                          >
                            <Edit2 size={11} />
                          </button>
                        )}
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
              Set your demo balance to practice trading. Limit is $1 to $5,000,000.
            </p>
            <input
              type="number"
              min="1"
              max="5000000"
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
              className={`w-full px-3 py-2.5 mb-2 rounded-xl border text-sm outline-none focus:border-sky-500 ${inputBg}`}
              placeholder="Amount (e.g. 10000)"
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

      {editingSlTp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={() => setEditingSlTp(null)}>
          <div className={`w-full max-w-sm rounded-2xl border p-5 ${cardBg}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`font-semibold mb-2 ${textPrimary}`}>Edit Stop Loss / Take Profit</h3>
            <p className={`text-xs mb-4 ${textMuted}`}>
              {editingSlTp.direction === "long" ? "Long" : "Short"} {editingSlTp.symbol.replace("USDT", "")} — Entry ${editingSlTp.entryPrice}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className={`text-[10px] ${textMuted}`}>Stop Loss</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="None"
                  value={editSl}
                  onChange={(e) => setEditSl(e.target.value)}
                  className={`w-full px-2.5 py-2 rounded-lg border text-xs outline-none focus:border-red-500 ${inputBg}`}
                />
              </div>
              <div>
                <label className={`text-[10px] ${textMuted}`}>Take Profit</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="None"
                  value={editTp}
                  onChange={(e) => setEditTp(e.target.value)}
                  className={`w-full px-2.5 py-2 rounded-lg border text-xs outline-none focus:border-green-500 ${inputBg}`}
                />
              </div>
            </div>
            {editSlTpError && <p className="text-xs text-red-400 mb-3">{editSlTpError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditingSlTp(null)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${hoverBg} ${textPrimary}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSlTp}
                disabled={editSlTpSaving}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {editSlTpSaving ? <Loader2 size={16} className="animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
