import { useEffect, useState } from "react";
import { ShieldQuestion, Check, X, Save } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getPendingKyc, type PendingKyc } from "@/lib/admin";
import { reviewKyc, updateKycInfo, type KycPersonalInfo } from "@/lib/kyc";

export default function AdminKyc() {
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();
  const [submissions, setSubmissions] = useState<PendingKyc[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, KycPersonalInfo>>({});

  const load = () => getPendingKyc().then(setSubmissions);

  useEffect(() => {
    load();
  }, []);

  const getInfo = (s: PendingKyc): KycPersonalInfo => edits[s.uid] ?? s.personalInfo;

  const updateField = (s: PendingKyc, field: keyof KycPersonalInfo, value: string) => {
    setEdits((prev) => ({ ...prev, [s.uid]: { ...getInfo(s), [field]: value } }));
  };

  const handleSave = async (s: PendingKyc) => {
    setSavingUid(s.uid);
    try {
      await updateKycInfo(s.uid, getInfo(s));
      await load();
      setEdits((prev) => {
        const next = { ...prev };
        delete next[s.uid];
        return next;
      });
    } finally {
      setSavingUid(null);
    }
  };

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
        {submissions.map((s) => {
          const info = getInfo(s);
          const dirty = Boolean(edits[s.uid]);

          return (
            <Panel key={s.uid} className={`border-t ${divider}`}>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs mb-1 ${textMuted}`}>Full Legal Name</label>
                      <input
                        value={info.fullName}
                        onChange={(e) => updateField(s, "fullName", e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-violet-500 ${inputBg}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${textMuted}`}>Date of Birth</label>
                      <input
                        type="date"
                        value={info.dateOfBirth}
                        onChange={(e) => updateField(s, "dateOfBirth", e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-violet-500 ${inputBg}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${textMuted}`}>Residential Address</label>
                      <input
                        value={info.address}
                        onChange={(e) => updateField(s, "address", e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-violet-500 ${inputBg}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${textMuted}`}>Country</label>
                      <input
                        value={info.country}
                        onChange={(e) => updateField(s, "country", e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-violet-500 ${inputBg}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs">
                    <a href={s.idProofUrl} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                      ID Proof
                    </a>
                    <a href={s.addressProofUrl} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                      Address Proof
                    </a>
                    <a href={s.selfieUrl} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                      Selfie
                    </a>
                    {dirty && (
                      <button
                        onClick={() => handleSave(s)}
                        disabled={savingUid === s.uid}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/30 text-xs font-semibold disabled:opacity-60"
                      >
                        <Save size={12} /> {savingUid === s.uid ? "Saving..." : "Save Changes"}
                      </button>
                    )}
                  </div>
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
          );
        })}
      </div>
    </>
  );
}
