import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowDownToLine, Upload, Copy, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { QrCode } from "@/app/components/QrCode";
import { createDepositRequest } from "@/lib/wallet";
import { getAppConfig, type AppConfig, type PaymentInfo } from "@/lib/config";

const METHOD = "Binance Pay";

function CopyField({ value }: { value: string }) {
  const { inputBg } = useThemeClasses();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex gap-2">
      <div className={`flex-1 flex items-center px-3 py-2 rounded-lg border text-sm font-mono truncate ${inputBg}`}>
        {value}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
          copied
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25"
        }`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function BinancePayBox({ paymentInfo }: { paymentInfo: PaymentInfo }) {
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();
  const [coinSymbol, setCoinSymbol] = useState(paymentInfo.coins[0]?.symbol);
  const coin = paymentInfo.coins.find((c) => c.symbol === coinSymbol) ?? paymentInfo.coins[0];

  if (!coin) return null;

  return (
    <div className={`rounded-xl border p-4 ${inputBg}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-black font-bold text-xs">
          B
        </div>
        <p className={`text-sm font-semibold ${textPrimary}`}>Pay with Binance</p>
        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">sample</span>
      </div>
      <p className={`text-xs mb-3 ${textMuted}`}>
        Scan the QR code or copy the address below, send your deposit, then upload the payment
        screenshot as proof.
      </p>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 mb-4 border-b ${divider}`}>
        <div className="flex flex-col items-center justify-center gap-2">
          <QrCode value={coin.address} size={140} />
          <span className={`text-xs ${textMuted}`}>{coin.network} network</span>
        </div>
        <div className="space-y-3">
          <div>
            <p className={`text-xs mb-1.5 ${textMuted}`}>Pay in</p>
            <select
              value={coinSymbol}
              onChange={(e) => setCoinSymbol(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
            >
              {paymentInfo.coins.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.icon} {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className={`text-xs mb-1.5 ${textMuted}`}>{coin.label} address</p>
            <CopyField value={coin.address} />
          </div>
        </div>
      </div>

      <div className="mb-3">
        <p className={`text-xs mb-1.5 ${textMuted}`}>Or use your Binance Pay ID</p>
        <CopyField value={paymentInfo.binancePayId} />
      </div>

      <a
        href={paymentInfo.binancePayLink}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-yellow-500 to-amber-500 text-black"
      >
        <ExternalLink size={13} />
        Open Binance to Pay
      </a>
      <p className={`text-xs mt-2 ${textMuted}`}>
        These addresses and Pay ID are placeholders — swap in your real deposit addresses / Binance
        Pay ID before accepting live payments.
      </p>
    </div>
  );
}

export default function WalletDeposit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();

  const [purpose, setPurpose] = useState<"wallet" | "investment" | "order">(
    searchParams.get("purpose") === "investment"
      ? "investment"
      : searchParams.get("purpose") === "order"
        ? "order"
        : "wallet"
  );
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [plan, setPlan] = useState("");
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getAppConfig().then((cfg) => {
      setConfig(cfg);
      setPlan(Object.keys(cfg.plans)[0]);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !proofFile) {
      setError("Please attach a payment proof.");
      return;
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (purpose === "investment" && config) {
      const minAmount = config.plans[plan]?.minAmount ?? 0;
      if (numericAmount < minAmount) {
        setError(`Minimum for this plan is $${minAmount}.`);
        return;
      }
    }

    setError(null);
    setSubmitting(true);
    try {
      await createDepositRequest({
        uid: user.id,
        amount: numericAmount,
        method: METHOD,
        proofFile,
        purpose,
        plan: purpose === "investment" ? plan : undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit deposit request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <>
        <PageHeader icon={<ArrowDownToLine size={20} />} title="Deposit Request Submitted" />
        <Panel className="text-center py-10">
          <p className={`font-semibold ${textPrimary}`}>Your deposit request is pending review.</p>
          <p className={`text-sm mt-1 ${textMuted}`}>An admin will approve it and credit your wallet shortly.</p>
          <button onClick={() => navigate("/wallet")} className="mt-4 px-4 py-2 bg-violet-500/15 text-violet-400 border border-violet-500/30 rounded-xl text-sm font-semibold">
            Back to Wallet
          </button>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader icon={<ArrowDownToLine size={20} />} title="Deposit" subtitle="Submit a deposit — funds are credited after admin approval" />

      <Panel>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="flex gap-2">
            {(["wallet", "order", "investment"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPurpose(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  purpose === p ? "bg-violet-500/15 text-violet-400 border-violet-500/30" : `${textMuted} ${divider}`
                }`}
              >
                {p === "wallet" ? "Wallet Top-Up" : p === "order" ? "Recover Locked Balance" : "Investment Plan"}
              </button>
            ))}
          </div>

          {purpose === "investment" && config && (
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${inputBg}`}>
              {Object.entries(config.plans).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label} — min ${p.minAmount}
                </option>
              ))}
            </select>
          )}

          <input
            type="number"
            required
            min="1"
            step="0.01"
            placeholder="Amount (USD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 ${inputBg}`}
          />

          {config && <BinancePayBox paymentInfo={config.paymentInfo} />}

          <div>
            <p className={`text-xs mb-2 ${textMuted}`}>Payment Proof (screenshot/receipt)</p>
            <div className={`px-3 py-2.5 rounded-xl border ${inputBg}`}>
              <input
                type="file"
                required
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className={`w-full text-sm ${textMuted}`}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
          >
            <Upload size={15} />
            {submitting ? "Submitting..." : "Submit Deposit Request"}
          </button>
        </form>
      </Panel>
    </>
  );
}
