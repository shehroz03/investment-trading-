import { useEffect, useState } from "react";
import { Crown, CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getVipRecord, submitVipRequest, type VipRecord } from "@/lib/vip";
import { NON_VIP_WITHDRAW_CAP } from "@/lib/wallet";

const statusMeta = {
  none: { label: "Not Activated", color: "text-slate-400", icon: Clock },
  pending: { label: "Pending Review", color: "text-amber-400", icon: Clock },
  approved: { label: "VIP Active", color: "text-green-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-red-400", icon: XCircle },
};

export default function VipChannel() {
  const { user, profile } = useAuth();
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();

  const [record, setRecord] = useState<VipRecord | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getVipRecord(user.id).then(setRecord);
  }, [user]);

  const status = profile?.vipStatus ?? "none";
  const meta = statusMeta[status];
  const canApply = status === "none" || status === "rejected";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitVipRequest(user.id, note);
      setRecord(await getVipRecord(user.id));
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit VIP activation request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Crown size={20} />}
        title="VIP Channel"
        subtitle={`Activate VIP to withdraw above $${NON_VIP_WITHDRAW_CAP.toLocaleString()}`}
      />

      <Panel className="flex items-center gap-3">
        <meta.icon size={20} className={meta.color} />
        <div>
          <p className={`font-semibold text-sm ${textPrimary}`}>{meta.label}</p>
          <p className={`text-xs ${textMuted}`}>
            {status === "approved"
              ? `You can withdraw any amount — the $${NON_VIP_WITHDRAW_CAP.toLocaleString()} cap no longer applies.`
              : status === "pending"
                ? "An admin is reviewing your VIP activation request."
                : status === "rejected"
                  ? "Your activation request was rejected — you can submit a new one below."
                  : `Withdrawals are capped at $${NON_VIP_WITHDRAW_CAP.toLocaleString()} until VIP is activated.`}
          </p>
        </div>
      </Panel>

      {canApply && (
        <Panel>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>Request VIP Activation</p>
          <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
            <div>
              <label className={`block text-xs mb-1.5 ${textMuted}`}>Reason for upgrade (optional)</label>
              <textarea
                rows={3}
                placeholder="e.g. I need to withdraw larger amounts for..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 resize-none ${inputBg}`}
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className={`pt-2 border-t ${divider}`}>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold mt-3 flex items-center justify-center gap-2"
              >
                <Send size={15} />
                {submitting ? "Submitting..." : "Submit Activation Request"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {record && !canApply && (
        <Panel>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>Your Submission</p>
          <p className={`text-sm ${textPrimary}`}>{record.note || "No reason provided."}</p>
        </Panel>
      )}
    </>
  );
}
