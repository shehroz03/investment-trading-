import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Radio, ChevronRight } from "lucide-react";
import {
  subscribeToCryptoTicker,
  subscribeToSimulatedTicker,
  COIN_META,
  SIMULATED_COIN_META,
  type CryptoTick,
} from "@/lib/crypto";
import { useThemeClasses } from "@/app/components/Panel";
import { AllCoinsModal } from "@/app/components/AllCoinsModal";

export function CryptoTicker() {
  const { textPrimary, textMuted, cardBg } = useThemeClasses();
  const [ticks, setTicks] = useState<Record<string, CryptoTick>>({});
  const [live, setLive] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToCryptoTicker((next) => {
      setTicks((prev) => ({ ...prev, ...next }));
      setLive(true);
    });
    const unsubscribeSimulated = subscribeToSimulatedTicker((next) => {
      setTicks((prev) => ({ ...prev, ...next }));
    });
    return () => {
      unsubscribe();
      unsubscribeSimulated();
    };
  }, []);

  const symbols = [...Object.keys(COIN_META), ...Object.keys(SIMULATED_COIN_META)];
  const allMeta: Record<string, { label: string; icon: string }> = { ...COIN_META, ...SIMULATED_COIN_META };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Radio size={12} className={live ? "text-green-400 animate-pulse" : textMuted} />
          <span className={`text-xs ${textMuted}`}>{live ? "Live prices" : "Connecting..."}</span>
        </div>
        <button
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1 text-xs text-teal-500 font-medium hover:underline"
        >
          More
          <ChevronRight size={13} />
        </button>
      </div>
      {showAll && <AllCoinsModal onClose={() => setShowAll(false)} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {symbols.map((symbol) => {
          const tick = ticks[symbol];
          const meta = allMeta[symbol];
          const positive = (tick?.changePercent ?? 0) >= 0;

          return (
            <div key={symbol} className={`rounded-xl border p-3 ${cardBg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold ${textMuted}`}>{meta.label}</span>
                <span className={`text-sm font-bold ${textPrimary}`}>{meta.icon}</span>
              </div>
              {tick ? (
                <>
                  <p className={`font-bold ${textPrimary}`}>
                    ${tick.price.toLocaleString(undefined, { maximumFractionDigits: tick.price < 1 ? 4 : 2 })}
                  </p>
                  <p className={`text-xs flex items-center gap-1 ${positive ? "text-green-400" : "text-red-400"}`}>
                    {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {positive ? "+" : ""}
                    {tick.changePercent.toFixed(2)}%
                  </p>
                </>
              ) : (
                <p className={`text-xs ${textMuted}`}>Loading...</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
