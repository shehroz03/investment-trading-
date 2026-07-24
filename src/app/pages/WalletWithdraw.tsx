import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpFromLine } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { createWithdrawRequest } from "@/lib/wallet";

const METHOD_GROUPS: { label: string; methods: string[] }[] = [
  {
    label: "Payment Apps",
    methods: ["Cash App", "PayPal", "Venmo", "Zelle", "Chime"],
  },
  {
    label: "Banks",
    methods: [
      "Chase Bank",
      "Wells Fargo Bank",
      "Bank of America",
      "Citibank",
      "Capital One",
      "US Bank",
      "PNC Bank",
      "TD Bank",
      "Truist Bank",
      "Regions Bank",
      "Fifth Third Bank",
      "KeyBank",
      "HSBC Bank",
      "Ally Bank",
      "Discover Bank",
    ],
  },
  {
    label: "Crypto",
    methods: ["Bitcoin (BTC)", "Ethereum (ETH)", "USD Coin (USDC)", "Tether (USDT)", "BNB"],
  },
];

const METHODS = METHOD_GROUPS.flatMap((g) => g.methods);

export default function WalletWithdraw() {
  const { user, wallet } = useAuth();
  const navigate = useNavigate();
  const { textPrimary, textMuted, inputBg } = useThemeClasses();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (wallet && numericAmount > wallet.available) {
      setError("Amount exceeds your available balance.");
      return;
    }
    if (!destination.trim()) {
      setError("Enter a withdrawal destination (wallet address / account number).");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await createWithdrawRequest({ uid: user.uid, amount: numericAmount, method, destination });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit withdrawal request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <>
        <PageHeader icon={<ArrowUpFromLine size={20} />} title="Withdrawal Request Submitted" />
        <Panel className="text-center py-10">
          <p className={`font-semibold ${textPrimary}`}>Your withdrawal request is pending review.</p>
          <p className={`text-sm mt-1 ${textMuted}`}>The amount has been moved to your pending balance until an admin approves it.</p>
          <button onClick={() => navigate("/wallet")} className="mt-4 px-4 py-2 bg-teal-500/15 text-teal-400 border border-teal-500/30 rounded-xl text-sm font-semibold">
            Back to Wallet
          </button>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader icon={<ArrowUpFromLine size={20} />} title="Withdraw" subtitle="Request a withdrawal from your available balance" />

      <Panel>
        <p className={`text-sm mb-4 ${textMuted}`}>
          Available balance: <span className={`font-semibold ${textPrimary}`}>${(wallet?.available ?? 0).toFixed(2)}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <input
            type="number"
            required
            min="1"
            step="0.01"
            placeholder="Amount (USD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
          />

          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${inputBg}`}>
            {METHOD_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <input
            required
            placeholder="Destination (wallet address / account number)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/30"
          >
            {submitting ? "Submitting..." : "Submit Withdrawal Request"}
          </button>
        </form>
      </Panel>
    </>
  );
}
