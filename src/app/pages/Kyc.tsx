import { useEffect, useState } from "react";
import { ShieldCheck, Upload, CheckCircle2, Clock, XCircle, Camera, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getKyc, submitKyc, type KycRecord } from "@/lib/kyc";

const statusMeta = {
  none: { label: "Not Submitted", color: "text-slate-400", icon: Clock },
  pending: { label: "Pending Review", color: "text-amber-400", icon: Clock },
  approved: { label: "Approved", color: "text-green-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-red-400", icon: XCircle },
};

export default function Kyc() {
  const { user, profile } = useAuth();
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();

  const [record, setRecord] = useState<KycRecord | null>(null);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [idProof, setIdProof] = useState<File | null>(null);
  const [addressProof, setAddressProof] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getKyc(user.uid).then(setRecord);
  }, [user]);

  const status = profile?.kycStatus ?? "none";
  const meta = statusMeta[status];
  const canEdit = status === "none" || status === "rejected";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !idProof || !addressProof || !selfie) {
      setError("Please attach all three documents.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitKyc(user.uid, { fullName, dateOfBirth, address, country }, { idProof, addressProof, selfie });
      setRecord(await getKyc(user.uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit KYC.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader icon={<ShieldCheck size={20} />} title="KYC Verification" subtitle="Verify your identity to unlock deposits and withdrawals" />

      <Panel className="flex items-center gap-3">
        <meta.icon size={20} className={meta.color} />
        <div>
          <p className={`font-semibold text-sm ${textPrimary}`}>{meta.label}</p>
          <p className={`text-xs ${textMuted}`}>
            {status === "approved"
              ? "Your identity has been verified."
              : status === "pending"
                ? "We're reviewing your submission."
                : status === "rejected"
                  ? "Your submission was rejected — please resubmit with corrected documents."
                  : "Submit your documents below to get verified."}
          </p>
        </div>
      </Panel>

      {canEdit && (
        <Panel>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>1. Personal Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs mb-1.5 ${textMuted}`}>Full Legal Name</label>
                  <input required placeholder="Full Legal Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`} />
                </div>
                <div>
                  <label className={`block text-xs mb-1.5 ${textMuted}`}>Date of Birth</label>
                  <input required type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`} />
                </div>
                <div className="sm:col-span-2">
                  <label className={`block text-xs mb-1.5 ${textMuted}`}>Residential Address</label>
                  <input required placeholder="Residential Address" value={address} onChange={(e) => setAddress(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`} />
                </div>
                <div>
                  <label className={`block text-xs mb-1.5 ${textMuted}`}>Country</label>
                  <input required placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`} />
                </div>
              </div>
            </div>

            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>2. Identity Proof</p>
              <label className={`block text-xs mb-1.5 ${textMuted}`}>Government ID (passport, national ID, driver's license)</label>
              <div className={`px-3 py-2.5 rounded-xl border ${inputBg}`}>
                <input required type="file" accept="image/*,.pdf" onChange={(e) => setIdProof(e.target.files?.[0] ?? null)} className={`w-full text-sm ${textMuted}`} />
              </div>
            </div>

            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>3. Address Proof</p>
              <label className={`block text-xs mb-1.5 ${textMuted}`}>Utility bill, bank statement, or similar (dated within 3 months)</label>
              <div className={`px-3 py-2.5 rounded-xl border ${inputBg}`}>
                <input required type="file" accept="image/*,.pdf" onChange={(e) => setAddressProof(e.target.files?.[0] ?? null)} className={`w-full text-sm ${textMuted}`} />
              </div>
            </div>

            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>4. Selfie</p>
              <label className={`block text-xs mb-1.5 ${textMuted}`}>A clear photo of your face</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25">
                  <Camera size={14} />
                  Take Live Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                <label className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border ${divider} ${textMuted}`}>
                  <ImageIcon size={14} />
                  Choose from Gallery
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
              {selfie && <p className={`text-xs mt-2 ${textMuted}`}>Selected: {selfie.name}</p>}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2"
            >
              <Upload size={15} />
              {submitting ? "Submitting..." : "Submit for Verification"}
            </button>
          </form>
        </Panel>
      )}

      {record && !canEdit && (
        <Panel>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>Submitted Information</p>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm ${textPrimary}`}>
            <p><span className={textMuted}>Name:</span> {record.personalInfo.fullName}</p>
            <p><span className={textMuted}>Country:</span> {record.personalInfo.country}</p>
            <p className="sm:col-span-2"><span className={textMuted}>Address:</span> {record.personalInfo.address}</p>
          </div>
        </Panel>
      )}
    </>
  );
}
