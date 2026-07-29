import { useEffect, useState } from "react";
import { ArrowUpFromLine, Check, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getPendingWithdrawals, type PendingWithdrawal } from "@/lib/admin";
import { approveWithdrawal, rejectWithdrawal } from "@/lib/wallet";

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const { textPrimary, textMuted, divider, theadBg } = useThemeClasses();
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => getPendingWithdrawals().then(setWithdrawals);

  useEffect(() => {
    load();
  }, []);

  const handle = async (action: "approve" | "reject", id: string) => {
    if (!user) return;
    setBusyId(id);
    try {
      if (action === "approve") await approveWithdrawal(id, user.id);
      else await rejectWithdrawal(id, user.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader icon={<ArrowUpFromLine size={20} />} title="Pending Withdrawals" subtitle={`${withdrawals.length} awaiting review`} />

      <Panel className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
                <th className="text-left px-5 py-3">User</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Method</th>
                <th className="text-left px-5 py-3">Destination</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`text-center py-10 text-sm ${textMuted}`}>
                    No pending withdrawals.
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id} className={`text-sm border-t ${divider}`}>
                    <td className={`px-5 py-3 font-mono text-xs ${textMuted}`}>{w.uid.slice(0, 8)}</td>
                    <td className={`px-5 py-3 font-semibold ${textPrimary}`}>${w.amount.toFixed(2)}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>{w.method}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>{w.destination}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handle("approve", w.id)}
                          disabled={busyId === w.id}
                          className="p-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 disabled:opacity-60"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handle("reject", w.id)}
                          disabled={busyId === w.id}
                          className="p-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 disabled:opacity-60"
                        >
                          <X size={14} />
                        </button>
                      </div>
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
