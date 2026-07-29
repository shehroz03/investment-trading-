import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getUserTransactions, groupByPeriod, exportTransactionsToCsv, type TransactionRecord } from "@/lib/transactions";

export default function ReportsMonthly() {
  const { user } = useAuth();
  const { textPrimary, textMuted, divider, theadBg } = useThemeClasses();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserTransactions(user.id).then(setTransactions);
  }, [user]);

  const groups = groupByPeriod(transactions, "month");

  return (
    <>
      <PageHeader
        icon={<FileText size={20} />}
        title="Monthly Reports"
        subtitle="Your activity grouped by month"
        action={
          <button
            onClick={() => exportTransactionsToCsv(transactions, "monthly-report.csv")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-teal-500/15 text-teal-400 border border-teal-500/30"
          >
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <Panel className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
                <th className="text-left px-5 py-3">Month</th>
                <th className="text-left px-5 py-3">Transactions</th>
                <th className="text-left px-5 py-3">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={3} className={`text-center py-10 text-sm ${textMuted}`}>
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.key} className={`text-sm border-t ${divider}`}>
                    <td className={`px-5 py-3 ${textPrimary}`}>{g.key}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>{g.count}</td>
                    <td className={`px-5 py-3 font-semibold ${textPrimary}`}>${g.total.toFixed(2)}</td>
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
