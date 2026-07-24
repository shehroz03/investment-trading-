import { useEffect, useState } from "react";
import { ShieldQuestion, Check, X } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getPendingKyc, type PendingKyc } from "@/lib/admin";
import { reviewKyc } from "@/lib/kyc";

export default function AdminKyc() {
  const { textPrimary, textMuted, divider } = useThemeClasses();
  const [submissions, setSubmissions] = useState<PendingKyc[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = () => getPendingKyc().then(setSubmissions);

  useEffect(() => {
    load();
  }, []);

  const handle = async (action: "approved" | "rejected", uid: string) => {
    setBusyUid(uid);
    try {
      await reviewKyc(uid, action);
      await load();
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <>
      <PageHeader icon={<ShieldQuestion size={20} />} title="Pending KYC" subtitle={`${submissions.length} awaiting review`} />

      {submissions.length === 0 && (
        <Panel className="text-center py-10">
          <p className={`text-sm ${textMuted}`}>No pending KYC submissions.</p>
        </Panel>
      )}

      <div className="space-y-3">
        {submissions.map((s) => (
          <Panel key={s.uid} className={`border-t ${divider}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className={`font-semibold text-sm ${textPrimary}`}>{s.personalInfo.fullName}</p>
                <p className={`text-xs ${textMuted}`}>
                  {s.personalInfo.country} &bull; DOB {s.personalInfo.dateOfBirth} &bull; {s.personalInfo.address}
                </p>
                <div className="flex gap-3 mt-2 text-xs">
                  <a href={s.idProofUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
                    ID Proof
                  </a>
                  <a href={s.addressProofUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
                    Address Proof
                  </a>
                  <a href={s.selfieUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
                    Selfie
                  </a>
                </div>
              </div>
              <div className="flex gap-2">
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
