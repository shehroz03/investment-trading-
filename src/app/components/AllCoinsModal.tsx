import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { subscribeToAllTickers, type MarketTick } from "@/lib/crypto";
import { useThemeClasses } from "@/app/components/Panel";

interface AllCoinsModalProps {
  onClose: () => void;
  onSelect?: (symbol: string) => void;
}

export function AllCoinsModal({ onClose, onSelect }: AllCoinsModalProps) {
  const { textPrimary, textMuted, cardBg, inputBg, divider, hoverBg } = useThemeClasses();
  const [ticks, setTicks] = useState<MarketTick[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToAllTickers(setTicks);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filtered = useMemo(() => {
    const sorted = [...ticks].sort((a, b) => b.quoteVolume - a.quoteVolume);
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => t.base.toLowerCase().includes(q));
  }, [ticks, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`w-full max-w-2xl max-h-[80vh] rounded-2xl border flex flex-col ${cardBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit flex-shrink-0">
          <h2 className={`font-semibold ${textPrimary}`}>
            {onSelect ? "Select a coin to trade" : "All Coins"}{" "}
            {ticks.length > 0 && <span className={`text-xs font-normal ${textMuted}`}>({ticks.length})</span>}
          </h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${hoverBg} ${textMuted}`}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-inherit flex-shrink-0">
          <div className="relative">
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              autoFocus
              placeholder="Search coins (e.g. BTC, ETH, SOL)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {ticks.length === 0 ? (
            <p className={`text-sm text-center py-10 ${textMuted}`}>Loading market data...</p>
          ) : filtered.length === 0 ? (
            <p className={`text-sm text-center py-10 ${textMuted}`}>No coins match "{search}"</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className={`text-xs uppercase tracking-wider ${textMuted} sticky top-0 ${cardBg}`}>
                  <th className="text-left px-5 py-2 font-semibold">Coin</th>
                  <th className="text-right px-5 py-2 font-semibold">Price</th>
                  <th className="text-right px-5 py-2 font-semibold">24h Change</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const positive = t.changePercent >= 0;
                  return (
                    <tr
                      key={t.symbol}
                      onClick={onSelect ? () => onSelect(t.symbol) : undefined}
                      className={`border-t ${divider} ${hoverBg} ${onSelect ? "cursor-pointer" : ""}`}
                    >
                      <td className={`px-5 py-2.5 font-medium ${textPrimary}`}>{t.base}</td>
                      <td className={`px-5 py-2.5 text-right ${textPrimary}`}>
                        ${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 1 ? 6 : 2 })}
                      </td>
                      <td className={`px-5 py-2.5 text-right text-xs ${positive ? "text-green-400" : "text-red-400"}`}>
                        {positive ? "+" : ""}
                        {t.changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
