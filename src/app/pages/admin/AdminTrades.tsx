import { useEffect, useState } from "react";
import { LineChart, Lock, Unlock } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getAllTrades } from "@/lib/admin";
import { setTradeOutcome, setTradeFrozen, type Trade } from "@/lib/trading";

export default function AdminTrades() {
  const { textPrimary, textMuted, divider, theadBg, hoverBg } = useThemeClasses();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [freezingId, setFreezingId] = useState<string | null>(null);

  useEffect(() => {
    getAllTrades().then(setTrades);
  }, []);

  const handleSetOutcome = async (tradeId: string, outcome: "win" | "loss") => {
    setActingId(tradeId);
    try {
      await setTradeOutcome(tradeId, outcome);
      setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, adminOutcome: outcome } : t)));
    } finally {
      setActingId(null);
    }
  };

  // Freezing blocks a trade from being closed — manually or via auto-settlement — until
  // unfrozen. Enforced server-side in api/closeTrade.js, not just here in the UI.
  const handleToggleFrozen = async (tradeId: string, currentlyFrozen: boolean) => {
    setFreezingId(tradeId);
    try {
      await setTradeFrozen(tradeId, !currentlyFrozen);
      setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, frozen: !currentlyFrozen } : t)));
    } finally {
      setFreezingId(null);
    }
  };

  const openCount = trades.filter((t) => t.status === "open").length;
  const totalPnl = trades.filter((t) => t.status === "closed").reduce((s, t) => s + (t.pnl ?? 0), 0);

  return (
    <>
      <PageHeader
        icon={<LineChart size={20} />}
        title="Trades"
        subtitle={`${trades.length} total • ${openCount} open • net settled P&L $${totalPnl.toFixed(2)}`}
      />

      <Panel className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
                <th className="text-left px-5 py-3">User</th>
                <th className="text-left px-5 py-3">Symbol</th>
                <th className="text-left px-5 py-3">Direction</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Entry</th>
                <th className="text-left px-5 py-3">Close</th>
                <th className="text-left px-5 py-3">P&L</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Opened</th>
                <th className="text-left px-5 py-3">Outcome</th>
                <th className="text-left px-5 py-3">Freeze</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={11} className={`text-center py-10 text-sm ${textMuted}`}>
                    No trades yet.
                  </td>
                </tr>
              ) : (
                trades.map((t) => (
                  <tr key={t.id} className={`text-sm border-t ${divider}`}>
                    <td className={`px-5 py-3 font-mono text-xs ${textMuted}`}>{t.uid.slice(0, 8)}</td>
                    <td className={`px-5 py-3 ${textPrimary}`}>{t.symbol.replace("USDT", "")}</td>
                    <td className={`px-5 py-3 ${t.direction === "long" ? "text-green-400" : "text-red-400"}`}>
                      {t.direction === "long" ? "Long" : "Short"}
                    </td>
                    <td className={`px-5 py-3 ${textPrimary}`}>${t.amount.toFixed(2)}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>${t.entryPrice.toLocaleString()}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>{t.closePrice ? `$${t.closePrice.toLocaleString()}` : "—"}</td>
                    <td className={`px-5 py-3 font-semibold ${t.pnl === undefined ? textMuted : t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.pnl === undefined ? "—" : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}`}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-amber-500/15 text-amber-400" : "bg-slate-500/15 text-slate-400"}`}>
                          {t.status}
                        </span>
                        {t.status === "open" && t.frozen && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
                            <Lock size={11} /> frozen
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-5 py-3 ${textMuted}`}>{t.openedAt ? new Date(t.openedAt).toLocaleString() : "—"}</td>
                    <td className="px-5 py-3">
                      {t.status !== "open" ? (
                        <span className={`text-xs ${textMuted}`}>—</span>
                      ) : t.adminOutcome ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.adminOutcome === "win" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                          {t.adminOutcome === "win" ? "Win queued" : "Loss queued"}
                        </span>
                      ) : (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleSetOutcome(t.id, "win")}
                            disabled={actingId === t.id}
                            className={`px-2 py-1 rounded-md text-xs font-semibold text-green-400 border border-green-500/30 disabled:opacity-60 ${hoverBg}`}
                          >
                            Win
                          </button>
                          <button
                            onClick={() => handleSetOutcome(t.id, "loss")}
                            disabled={actingId === t.id}
                            className={`px-2 py-1 rounded-md text-xs font-semibold text-red-400 border border-red-500/30 disabled:opacity-60 ${hoverBg}`}
                          >
                            Loss
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {t.status !== "open" ? (
                        <span className={`text-xs ${textMuted}`}>—</span>
                      ) : (
                        <button
                          onClick={() => handleToggleFrozen(t.id, Boolean(t.frozen))}
                          disabled={freezingId === t.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold disabled:opacity-60 ${
                            t.frozen
                              ? "text-sky-400 border border-sky-500/30"
                              : `${textMuted} border ${divider}`
                          } ${hoverBg}`}
                        >
                          {t.frozen ? <Unlock size={12} /> : <Lock size={12} />}
                          {freezingId === t.id ? "..." : t.frozen ? "Unfreeze" : "Freeze"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
