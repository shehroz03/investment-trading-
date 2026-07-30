import { useEffect, useState } from "react";
import {
  Users2,
  Copy,
  Check,
  Link2,
  TrendingUp,
  Award,
  Gift,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import {
  getMyReferrals,
  getReferralStats,
  getMyReferralCode,
  type ReferralRecord,
  type ReferralStats,
} from "@/lib/referrals";

const APP_BASE_URL = window.location.origin;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label}`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
        copied
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
          : "bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25"
      }`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied!" : `Copy ${label}`}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  const { textPrimary, textMuted } = useThemeClasses();
  return (
    <Panel>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold mb-0.5 ${textPrimary}`}>{value}</p>
      <p className={`text-xs ${textMuted}`}>{label}</p>
    </Panel>
  );
}

export default function MyReferrals() {
  const { user } = useAuth();
  const { textPrimary, textMuted, theadBg, divider } = useThemeClasses();

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [code, statsData, referralsList] = await Promise.all([
        getMyReferralCode(user.id),
        getReferralStats(user.id),
        getMyReferrals(user.id),
      ]);
      setReferralCode(code);
      setStats(statsData);
      setReferrals(referralsList);
      setLoading(false);
    };

    load();
  }, [user]);

  const referralLink = referralCode
    ? `${APP_BASE_URL}/signup?ref=${referralCode}`
    : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        icon={<Users2 size={20} />}
        title="My Referrals"
        subtitle="Share your link, grow your network, and earn commissions"
      />

      {/* Referral Link & Code Card */}
      <Panel className="mb-5">
        <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${textMuted}`}>
          Your Referral Details
        </p>

        {/* Referral Link */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={14} className="text-violet-500" />
            <span className={`text-xs font-medium ${textMuted}`}>Referral Link</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <input
                readOnly
                value={referralLink}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-mono truncate outline-none bg-white/4 border-white/10 ${textPrimary}`}
              />
            </div>
            <CopyButton value={referralLink} label="Link" />
          </div>
          <p className={`text-xs mt-2 ${textMuted}`}>
            Share this link. When someone clicks it, the referral code will be automatically filled in their signup form.
          </p>
        </div>

        <div className={`border-t ${divider} my-4`} />

        {/* Referral Code */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Gift size={14} className="text-amber-400" />
            <span className={`text-xs font-medium ${textMuted}`}>Referral Code</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold font-mono tracking-[0.3em] ${textPrimary}`}>
              {referralCode ?? "—"}
            </span>
            {referralCode && <CopyButton value={referralCode} label="Code" />}
          </div>
          <p className={`text-xs mt-2 ${textMuted}`}>
            Or share just this code. New users can manually enter it in the "Referral Code" box during signup.
          </p>
        </div>
      </Panel>

      {/* Commission Info Banner */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Award size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">$2 Signup Bonus</p>
            <p className={`text-xs ${textMuted}`}>Direct referrals (Level 1)</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/8">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-400">$1 Network Bonus</p>
            <p className={`text-xs ${textMuted}`}>Indirect referrals (Level 2)</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          icon={<Users2 size={18} className="text-violet-400" />}
          label="Total Referrals"
          value={stats?.totalReferrals ?? 0}
          accent="bg-violet-500/15"
        />
        <StatCard
          icon={<Award size={18} className="text-emerald-400" />}
          label="Level 1 (Direct)"
          value={stats?.level1Count ?? 0}
          accent="bg-emerald-500/15"
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-blue-400" />}
          label="Level 2 (Network)"
          value={stats?.level2Count ?? 0}
          accent="bg-blue-500/15"
        />
        <StatCard
          icon={<Gift size={18} className="text-amber-400" />}
          label="Total Earned"
          value={`$${(stats?.totalEarned ?? 0).toFixed(2)}`}
          accent="bg-amber-500/15"
        />
      </div>

      {/* Referrals Table */}
      <Panel>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${textMuted}`}>
          Referral History
        </p>

        {referrals.length === 0 ? (
          <div className="text-center py-12">
            <Users2 size={32} className={`mx-auto mb-3 ${textMuted}`} />
            <p className={`text-sm font-medium mb-1 ${textMuted}`}>No referrals yet</p>
            <p className={`text-xs ${textMuted}`}>
              Share your link or code to start earning commissions!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
                  <th className="text-left px-3 py-2.5 rounded-l-lg">User</th>
                  <th className="text-left px-3 py-2.5">Level</th>
                  <th className="text-left px-3 py-2.5">Source</th>
                  <th className="text-left px-3 py-2.5">Bonus</th>
                  <th className="text-left px-3 py-2.5 rounded-r-lg">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-3 py-3">
                      <div>
                        <p className={`font-medium ${textPrimary}`}>
                          {r.referred_name ?? "—"}
                        </p>
                        <p className={`text-xs ${textMuted}`}>@{r.referred_username ?? "—"}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.level === 1
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        Level {r.level}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs capitalize ${textMuted}`}>
                        {r.source === "signup" ? "🎉 Signup" : "💰 Deposit"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-emerald-400 font-semibold">
                        +${r.commission_amount.toFixed(2)}
                      </span>
                    </td>
                    <td className={`px-3 py-3 text-xs ${textMuted}`}>
                      {new Date(r.created_at).toLocaleDateString("en-PK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
