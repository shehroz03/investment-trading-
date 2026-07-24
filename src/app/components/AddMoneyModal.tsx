import { useState } from "react";
import { X, Wallet } from "lucide-react";
import { useThemeClasses } from "@/app/components/Panel";
import { creditUserWallet } from "@/lib/admin";

interface AddMoneyModalProps {
  uid: string;
  name: string;
  onClose: () => void;
  onCredited: () => void;
}

export function AddMoneyModal({ uid, name, onClose, onCredited }: AddMoneyModalProps) {
  const { textPrimary, textMuted, cardBg, inputBg, divider } = useThemeClasses();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await creditUserWallet(uid, numericAmount, note);
      onCredited();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add money.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className={`w-full max-w-sm rounded-2xl border ${cardBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
          <h2 className={`font-semibold flex items-center gap-2 ${textPrimary}`}>
            <Wallet size={16} className="text-teal-400" />
            Add Money — {name}
          </h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${textMuted}`}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className={`block text-xs mb-1.5 ${textMuted}`}>Amount (USD)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
            />
          </div>
          <div>
            <label className={`block text-xs mb-1.5 ${textMuted}`}>Note (optional)</label>
            <input
              placeholder="Reason for this credit"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className={`pt-2 border-t ${divider}`}>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold mt-3"
            >
              {submitting ? "Adding..." : "Add Money"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
