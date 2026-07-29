import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Lock, Clock, Unlock } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getUserTransactions, type TransactionRecord } from "@/lib/transactions";
import { accrueLockedInterest } from "@/lib/trading";

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

export default function WalletBalance() {
  const { user, wallet } = useAuth();
  const { textPrimary, textMuted, divider, theadBg } = useThemeClasses();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserTransactions(user.id).then(setTransactions);
  }, [user]);

  // No cron in this project — credit whatever days of locked-balance interest have
  // accrued since the last check whenever the wallet page loads. The wallet's onSnapshot
  // listener in AuthContext picks up the resulting change live.
  useEffect(() => {
    if (!user) return;
    accrueLockedInterest().catch(() => {});
  }, [user]);

  if (!wallet) return null;

  const balances = [
    { label: "Available Balance", value: wallet.available, icon: Wallet, color: "text-teal-400 bg-teal-500/15" },
    {
      label: "Pending Order Balance",
      value: wallet.pendingOrder,
      icon: Clock,
      color: "text-amber-400 bg-amber-500/15",
      subtitle: wallet.locked > 0 ? "Deposit here to recover your locked balance" : undefined,
    },
    {
      label: "Locked Balance",
      value: wallet.locked,
      icon: Lock,
      color: "text-slate-400 bg-slate-500/15",
      subtitle: wallet.locked > 0 ? "Earning 1% daily interest" : undefined,
    },
    { label: "Withdrawal Pending", value: wallet.pending, icon: Clock, color: "text-purple-400 bg-purple-500/15" },
  ];

  const unlockRemaining =
    wallet.locked > 0 && wallet.unlockTarget != null ? Math.max(0, wallet.unlockTarget - wallet.available) : 0;

  return (
    <>
      <PageHeader
        icon={<Wallet size={20} />}
        title="My Wallet"
        subtitle="Manage your balance, deposits, and withdrawals"
        action={
          <div className="flex gap-2">
            <Link to="/wallet/deposit" className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-teal-600/30">
              <ArrowDownToLine size={15} /> Deposit
            </Link>
            <Link to="/wallet/withdraw" className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border ${textPrimary} ${divider}`}>
              <ArrowUpFromLine size={15} /> Withdraw
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((b) => (
          <Panel key={b.label} className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${b.color}`}>
              <b.icon size={18} />
            </div>
            <div>
              <p className={`text-xs ${textMuted}`}>{b.label}</p>
              <p className={`text-lg font-bold ${textPrimary}`}>{money(b.value)}</p>
              {b.subtitle && <p className="text-xs text-teal-400">{b.subtitle}</p>}
            </div>
          </Panel>
        ))}
      </div>

      {unlockRemaining > 0 && (
        <Panel className="flex items-center gap-3 border-amber-500/30">
          <div className="p-2.5 rounded-xl text-amber-400 bg-amber-500/15">
            <Unlock size={18} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${textPrimary}`}>
              Add {money(unlockRemaining)} more to your available balance to automatically unlock your locked balance.
            </p>
            <p className={`text-xs ${textMuted}`}>Your locked balance will move into your available balance once you reach this amount.</p>
          </div>
          <Link
            to="/wallet/deposit?purpose=wallet"
            className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-teal-600/30"
          >
            Deposit
          </Link>
        </Panel>
      )}

      <Panel className="!p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-inherit">
          <h3 className={`font-semibold text-sm ${textPrimary}`}>Wallet History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Note</th>
                <th className="text-left px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`text-center py-10 text-sm ${textMuted}`}>
                    No wallet activity yet.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className={`text-sm border-t ${divider}`}>
                    <td className={`px-5 py-3 ${textPrimary}`}>{typeLabels[t.type] ?? t.type}</td>
                    <td className={`px-5 py-3 font-semibold ${t.amount < 0 ? "text-red-400" : textPrimary}`}>
                      {t.amount < 0 ? "-" : ""}
                      {money(Math.abs(t.amount))}
                    </td>
                    <td className={`px-5 py-3 ${textMuted}`}>{t.note}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>{t.createdAt ? t.createdAt.toDate().toLocaleString() : "—"}</td>
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
