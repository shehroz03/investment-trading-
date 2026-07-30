import { Receipt, Search } from "lucide-react";
import { Link } from "react-router";
import type { TransactionRecord } from "@/lib/transactions";

interface DataTablesProps {
  darkMode: boolean;
  transactions: TransactionRecord[];
}

function EmptyState({ darkMode, icon, message }: { darkMode: boolean; icon: React.ReactNode; message: string }) {
  const textMuted = darkMode ? "text-slate-500" : "text-slate-400";
  return (
    <div className={`py-12 flex flex-col items-center gap-3 ${textMuted}`}>
      <div className={`p-4 rounded-full ${darkMode ? "bg-white/5" : "bg-slate-100"}`}>
        {icon}
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

const typeLabels: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  roi: "Daily ROI",
  trade_pnl: "Trade P&L",
  admin_credit: "Admin Credit",
  admin_balance_adjustment: "Balance Adjustment",
  admin_pending_order_adjustment: "Order Balance Adjustment",
  admin_locked_adjustment: "Locked Balance Adjustment",
  order_lock: "Balance Locked",
  balance_unlock: "Balance Unlocked",
};

export function DataTables({ darkMode, transactions }: DataTablesProps) {
  const cardBg = darkMode ? "bg-[#151B23] border-white/8" : "bg-white border-slate-200";
  const textPrimary = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-slate-400" : "text-slate-500";
  const theadBg = darkMode ? "bg-white/4 text-slate-400" : "bg-slate-50 text-slate-500";
  const divider = darkMode ? "border-white/6" : "border-slate-100";

  return (
    <div className={`rounded-xl border ${cardBg}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-violet-500" />
          <h3 className={`font-semibold text-sm ${textPrimary}`}>Recent Transactions</h3>
        </div>
        <Link
          to="/reports/daily"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${darkMode ? "bg-white/5 border-white/8 text-slate-400 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
        >
          <Search size={13} />
          <span>View Reports</span>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
              <th className="text-left px-5 py-3">ID</th>
              <th className="text-left px-5 py-3">Source</th>
              <th className="text-left px-5 py-3">Amount</th>
              <th className="text-left px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState darkMode={darkMode} icon={<Receipt size={28} />} message="No transactions found" />
                </td>
              </tr>
            ) : (
              transactions.slice(0, 5).map((t) => (
                <tr key={t.id} className={`text-sm border-t ${divider}`}>
                  <td className={`px-5 py-3 font-mono text-xs ${textMuted}`}>{t.id.slice(0, 6)}</td>
                  <td className={`px-5 py-3 ${textPrimary}`}>{typeLabels[t.type] ?? t.type}</td>
                  <td className={`px-5 py-3 font-semibold ${t.amount < 0 ? "text-red-400" : textPrimary}`}>
                    {t.amount < 0 ? "-" : ""}${Math.abs(t.amount).toFixed(2)}
                  </td>
                  <td className={`px-5 py-3 ${textMuted}`}>
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
