import {
  Wallet,
  ArrowDownToLine,
  Gift,
  ChevronRight,
} from "lucide-react";

interface MetricCardProps {
  darkMode: boolean;
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  badge?: string;
  badgeColor?: string;
  viewMore?: boolean;
}

function MetricCard({
  darkMode,
  label,
  value,
  icon,
  iconBg,
  badge,
  badgeColor,
  viewMore,
}: MetricCardProps) {
  const cardBg = darkMode ? "bg-[#151B23] border-white/8 hover:bg-[#1C2430]" : "bg-white border-slate-200 hover:bg-slate-50";
  const textPrimary = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div
      className={`relative rounded-xl border p-5 transition-all duration-200 cursor-pointer group ${cardBg}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>

      <p className={`text-xs font-medium mb-1 ${textMuted}`}>{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${textPrimary}`}>{value}</p>

      {viewMore && (
        <div className="flex items-center gap-1 mt-3">
          <span className="text-xs text-violet-500 font-medium group-hover:underline">View More</span>
          <ChevronRight size={12} className="text-violet-500" />
        </div>
      )}
    </div>
  );
}

interface MetricCardsGridProps {
  darkMode: boolean;
  totalEarning: number;
  totalWithdrawal: number;
  totalDeposit: number;
}

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MetricCardsGrid({
  darkMode,
  totalEarning,
  totalWithdrawal,
  totalDeposit,
}: MetricCardsGridProps) {
  const metrics = [
    {
      label: "Total Earning",
      value: money(totalEarning),
      icon: <Wallet size={18} className="text-emerald-400" />,
      iconBg: "bg-emerald-500/15",
    },
    {
      label: "Total Withdrawal",
      value: money(totalWithdrawal),
      icon: <ArrowDownToLine size={18} className="text-orange-400" />,
      iconBg: "bg-orange-500/15",
      viewMore: true,
    },
    {
      label: "Total Deposit",
      value: money(totalDeposit),
      icon: <Gift size={18} className="text-pink-400" />,
      iconBg: "bg-pink-500/15",
      viewMore: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((m) => (
        <MetricCard key={m.label} darkMode={darkMode} {...m} />
      ))}
    </div>
  );
}
