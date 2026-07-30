import { useState } from "react";
import { X, KeyRound } from "lucide-react";
import { useThemeClasses } from "@/app/components/Panel";
import { setUserPassword } from "@/lib/admin";

interface ChangePasswordModalProps {
  uid: string;
  name: string;
  onClose: () => void;
}

export function ChangePasswordModal({ uid, name, onClose }: ChangePasswordModalProps) {
  const { textPrimary, textMuted, cardBg, inputBg, divider } = useThemeClasses();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await setUserPassword(uid, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className={`w-full max-w-sm rounded-2xl border ${cardBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
          <h2 className={`font-semibold flex items-center gap-2 ${textPrimary}`}>
            <KeyRound size={16} className="text-violet-400" />
            Change Password — {name}
          </h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${textMuted}`}>
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-5 space-y-3">
            <p className={`text-sm ${textPrimary}`}>Password updated. The user will need to sign in with the new password next time.</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div>
              <label className={`block text-xs mb-1.5 ${textMuted}`}>New password</label>
              <input
                type="password"
                required
                minLength={6}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 ${inputBg}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1.5 ${textMuted}`}>Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 ${inputBg}`}
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className={`pt-2 border-t ${divider}`}>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold mt-3"
              >
                {submitting ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
