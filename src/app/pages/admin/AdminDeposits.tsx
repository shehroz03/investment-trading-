import { useEffect, useState } from "react";
import { ArrowDownToLine, Check, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getPendingDeposits, type PendingDeposit } from "@/lib/admin";
import { approveDeposit, rejectDeposit } from "@/lib/wallet";

export default function AdminDeposits() {
  const { user } = useAuth();
  const { textPrimary, textMuted, divider, theadBg } = useThemeClasses();
  const [deposits, setDeposits] = useState<PendingDeposit[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => getPendingDeposits().then(setDeposits);

  useEffect(() => {
    load();
  }, []);

  const handle = async (action: "approve" | "reject", id: string) => {
    if (!user) return;
    setBusyId(id);
    try {
      if (action === "approve") await approveDeposit(id, user.uid);
      else await rejectDeposit(id, user.uid);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader icon={<ArrowDownToLine size={20} />} title="Pending Deposits" subtitle={`${deposits.length} awaiting review`} />

      <Panel className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
                <th className="text-left px-5 py-3">User</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Purpose</th>
                <th className="text-left px-5 py-3">Method</th>
                <th className="text-left px-5 py-3">Proof</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deposits.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`text-center py-10 text-sm ${textMuted}`}>
                    No pending deposits.
                  </td>
                </tr>
              ) : (
                deposits.map((d) => (
                  <tr key={d.id} className={`text-sm border-t ${divider}`}>
                    <td className={`px-5 py-3 font-mono text-xs ${textMuted}`}>{d.uid.slice(0, 8)}</td>
                    <td className={`px-5 py-3 font-semibold ${textPrimary}`}>${d.amount.toFixed(2)}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>
                      {d.purpose === "investment" ? `Investment (${d.plan})` : d.purpose === "order" ? "Recover Locked Balance" : "Wallet"}
                    </td>
                    <td className={`px-5 py-3 ${textMuted}`}>{d.method}</td>
                    <td className="px-5 py-3">
                      <a href={d.proofUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
                        View
                      </a>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handle("approve", d.id)}
                          disabled={busyId === d.id}
                          className="p-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 disabled:opacity-60"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handle("reject", d.id)}
                          disabled={busyId === d.id}
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
