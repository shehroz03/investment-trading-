import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useTheme } from "@/app/context/ThemeContext";
import { MetricCardsGrid } from "@/app/components/MetricCards";
import { CryptoTicker } from "@/app/components/CryptoTicker";
import { TradingPanel } from "@/app/components/TradingPanel";
import { TradePnlChart } from "@/app/components/TradePnlChart";
import { DataTables } from "@/app/components/DataTables";
import { getUserTransactions, type TransactionRecord } from "@/lib/transactions";

export default function Dashboard() {
  const { user, profile, wallet } = useAuth();
  const { darkMode } = useTheme();

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;

    getUserTransactions(user.uid).then((txs) => {
      if (!cancelled) setTransactions(txs);
    });

    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  if (!profile || !wallet) return null;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard size={20} className="text-teal-500" />
            <h1 className={`font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Dashboard</h1>
          </div>
          <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Welcome back, <span className="text-teal-500 font-medium">{profile.name}</span>! Here's your investment overview.
          </p>
        </div>

        <div className={`flex items-center gap-4 px-4 py-2.5 rounded-xl border text-xs ${darkMode ? "bg-[#151B23] border-white/8" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className={darkMode ? "text-slate-400" : "text-slate-500"}>Active</span>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"} px-2`}>
            Live Market
          </span>
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
        </div>
        <CryptoTicker />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"} px-2`}>
            Trade
          </span>
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
        </div>
        <TradingPanel />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"} px-2`}>
            Profit &amp; Loss
          </span>
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
        </div>
        <TradePnlChart />
      </section>

      <section>
        <MetricCardsGrid
          darkMode={darkMode}
          totalEarning={wallet.totalEarnings}
          totalWithdrawal={wallet.totalWithdrawals}
          totalDeposit={wallet.totalDeposits}
        />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"} px-2`}>
            Activity
          </span>
          <div className={`flex-1 h-px ${darkMode ? "bg-white/6" : "bg-slate-200"}`}></div>
        </div>
        <DataTables darkMode={darkMode} transactions={transactions} />
      </section>
    </>
  );
}
