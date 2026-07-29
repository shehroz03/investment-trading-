import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowUpFromLine, Timer } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { createWithdrawRequest, NON_VIP_WITHDRAW_CAP } from "@/lib/wallet";

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

const TIME_LIMIT_MINUTES = [2, 4, 6, 8, 10] as const;
const SUBMIT_GRACE_MS = 1000;

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Persists the in-progress timer across a refresh (ProtectedRoute guarantees `user` is
// resolved by the time this page renders, so it's safe to key off uid from the start).
function timerStorageKey(uid: string) {
  return `withdraw-timer-${uid}`;
}

interface StoredTimer {
  deadline: number;
  selectedMinutes: number;
}

function readStoredTimer(uid: string): StoredTimer | null {
  try {
    const raw = localStorage.getItem(timerStorageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTimer>;
    if (typeof parsed.deadline !== "number" || typeof parsed.selectedMinutes !== "number") return null;
    return { deadline: parsed.deadline, selectedMinutes: parsed.selectedMinutes };
  } catch {
    return null;
  }
}

// A stored timer whose grace window has already passed by the time the page reloads
// counts as expired, same as if it had run out while the tab stayed open.
function isStoredTimerStillLive(stored: StoredTimer): boolean {
  return Date.now() < stored.deadline + SUBMIT_GRACE_MS;
}

export default function WalletWithdraw() {
  const { user, profile, wallet } = useAuth();
  const navigate = useNavigate();
  const { textPrimary, textMuted, inputBg, hoverBg, divider } = useThemeClasses();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Picking a time limit reserves a submission window: the deadline is a fixed timestamp
  // (not a countdown int) so it stays accurate regardless of tab-throttling. Lazily seeded
  // from localStorage so an in-progress timer survives a page refresh instead of silently
  // resetting to "no time limit selected."
  const [deadline, setDeadline] = useState<number | null>(() => {
    const stored = readStoredTimer(user!.uid);
    return stored && isStoredTimerStillLive(stored) ? stored.deadline : null;
  });
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(() => {
    const stored = readStoredTimer(user!.uid);
    return stored && isStoredTimerStillLive(stored) ? stored.selectedMinutes : null;
  });
  const [expired, setExpired] = useState(() => {
    const stored = readStoredTimer(user!.uid);
    return Boolean(stored) && !isStoredTimerStillLive(stored!);
  });
  const [, setTick] = useState(0);

  // Keeps localStorage in sync with the live deadline — written on every new selection,
  // removed the moment the attempt ends (expiry or successful submit) so a stale timer
  // never resurrects on the next visit.
  useEffect(() => {
    const key = timerStorageKey(user!.uid);
    if (deadline !== null && selectedMinutes !== null) {
      localStorage.setItem(key, JSON.stringify({ deadline, selectedMinutes } satisfies StoredTimer));
    } else {
      localStorage.removeItem(key);
    }
  }, [user, deadline, selectedMinutes]);

  useEffect(() => {
    if (deadline === null) return;

    // A separate, precisely-scheduled one-shot timeout actually flips the state to expired
    // — relying on a 1Hz polling interval to "catch" the right tick let drift shrink or
    // erase the visible 1-second grace window. The interval below only redraws the display.
    const expireTimeoutId = setTimeout(
      () => {
        setExpired(true);
        setDeadline(null);
        setSelectedMinutes(null);
      },
      Math.max(0, deadline + SUBMIT_GRACE_MS - Date.now())
    );
    const tickIntervalId = setInterval(() => setTick((t) => t + 1), 250);

    return () => {
      clearTimeout(expireTimeoutId);
      clearInterval(tickIntervalId);
    };
  }, [deadline]);

  const selectTimeLimit = (minutes: number) => {
    setExpired(false);
    setError(null);
    setSelectedMinutes(minutes);
    setDeadline(Date.now() + minutes * 60 * 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (deadline === null) {
      setError("Select a time limit first.");
      return;
    }
    if (Date.now() < deadline) {
      setError("Wait for the time limit to finish before submitting.");
      return;
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (wallet && numericAmount > wallet.available) {
      setError("Amount exceeds your available balance.");
      return;
    }
    if (numericAmount > NON_VIP_WITHDRAW_CAP && profile?.vipStatus !== "approved") {
      setError(`Withdrawals above $${NON_VIP_WITHDRAW_CAP.toLocaleString()} require an approved VIP activation — see the VIP Channel page.`);
      return;
    }
    if (!destination.trim()) {
      setError("Enter a withdrawal destination (wallet address / account number).");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await createWithdrawRequest({ uid: user.id, amount: numericAmount, method, destination });
      setDeadline(null);
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

  const now = Date.now();
  const remainingMs = deadline !== null ? deadline - now : null;
  // The submit window opens only once the countdown actually reaches zero, and stays open
  // for SUBMIT_GRACE_MS — deadline flips to null the instant that window closes (see the
  // scheduled expiry effect above), so "deadline !== null && now >= deadline" exactly
  // brackets that window, nothing more.
  const canSubmitNow = deadline !== null && now >= deadline;

  return (
    <>
      <PageHeader icon={<ArrowUpFromLine size={20} />} title="Withdraw" subtitle="Request a withdrawal from your available balance" />

      <Panel>
        <p className={`text-sm mb-1 ${textMuted}`}>
          Available balance: <span className={`font-semibold ${textPrimary}`}>${(wallet?.available ?? 0).toFixed(2)}</span>
        </p>
        {profile?.vipStatus !== "approved" && (
          <p className={`text-xs mb-4 ${textMuted}`}>
            Withdrawals above ${NON_VIP_WITHDRAW_CAP.toLocaleString()} require{" "}
            <Link to="/vip-channel" className="text-teal-400 hover:underline">
              VIP activation
            </Link>
            .
          </p>
        )}

        <div className="max-w-md space-y-2 mb-4">
          <p className={`text-xs mb-1.5 flex items-center gap-1 ${textMuted}`}>
            <Timer size={12} /> Time limit — wait it out, then submit the instant it ends
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TIME_LIMIT_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectTimeLimit(m)}
                disabled={deadline !== null}
                title={deadline !== null ? "Time limit is locked in until it expires or the request is submitted" : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border disabled:opacity-40 disabled:cursor-not-allowed ${
                  selectedMinutes === m
                    ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                    : `${hoverBg} ${textMuted} ${divider}`
                }`}
              >
                {m}min
              </button>
            ))}
          </div>
          {remainingMs !== null && !canSubmitNow && (
            <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
              <Timer size={14} className="animate-pulse" />
              Time remaining: {formatCountdown(remainingMs)} — submit unlocks when this hits 0:00
            </p>
          )}
          {canSubmitNow && (
            <p className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
              <Timer size={14} className="animate-pulse" />
              Submit now — this closes in a moment!
            </p>
          )}
          {expired && (
            <p className="text-xs text-red-400">Time limit reached — this withdrawal attempt was cancelled. Select a time limit to try again.</p>
          )}
        </div>

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
            disabled={submitting || !canSubmitNow}
            title={
              deadline === null
                ? "Select a time limit above first"
                : !canSubmitNow
                  ? "Wait for the time limit to finish before you can submit"
                  : undefined
            }
            className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/30"
          >
            {submitting ? "Submitting..." : "Submit Withdrawal Request"}
          </button>
        </form>
      </Panel>
    </>
  );
}
