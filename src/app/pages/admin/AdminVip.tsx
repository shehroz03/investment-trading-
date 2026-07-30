import { useEffect, useState } from "react";
import { Crown, Check, X } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getPendingVipRequests, type PendingVip } from "@/lib/admin";
import { reviewVipRequest } from "@/lib/vip";

export default function AdminVip() {
  const { textPrimary, textMuted, divider } = useThemeClasses();
  const [submissions, setSubmissions] = useState<PendingVip[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = () => getPendingVipRequests().then(setSubmissions);

  useEffect(() => {
    load();
  }, []);

  const handle = async (action: "approved" | "rejected", uid: string) => {
    setBusyUid(uid);
    try {
      await reviewVipRequest(uid, action);
      await load();
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <>
      <PageHeader icon={<Crown size={20} />} title="VIP Requests" subtitle={`${submissions.length} awaiting review`} />

      {submissions.length === 0 && (
        <Panel className="text-center py-10">
          <p className={`text-sm ${textMuted}`}>No pending VIP activation requests.</p>
        </Panel>
      )}

      <div className="space-y-3">
        {submissions.map((s) => (
          <Panel key={s.uid} className={`border-t ${divider}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-mono text-xs ${textMuted}`}>{s.uid}</p>
                <p className={`text-sm mt-1 ${textPrimary}`}>{s.note || "No reason provided."}</p>
                <p className={`text-xs mt-1 ${textMuted}`}>
                  {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handle("approved", s.uid)}
                  disabled={busyUid === s.uid}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-xs font-semibold disabled:opacity-60"
                >
                  <Check size={13} /> Approve
                </button>
                <button
                  onClick={() => handle("rejected", s.uid)}
                  disabled={busyUid === s.uid}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold disabled:opacity-60"
                >
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
