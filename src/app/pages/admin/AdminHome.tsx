import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ShieldCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldQuestion,
  Users,
  Settings as SettingsIcon,
  Newspaper,
  LineChart,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getPendingDeposits, getPendingWithdrawals, getPendingKyc, getAllUsers, getAllTrades } from "@/lib/admin";

export default function AdminHome() {
  const { profile } = useAuth();
  const { textPrimary } = useThemeClasses();
  const [counts, setCounts] = useState({ deposits: 0, withdrawals: 0, kyc: 0, users: 0, openTrades: 0 });

  useEffect(() => {
    Promise.all([getPendingDeposits(), getPendingWithdrawals(), getPendingKyc(), getAllUsers(), getAllTrades()]).then(
      ([deposits, withdrawals, kyc, users, trades]) => {
        setCounts({
          deposits: deposits.length,
          withdrawals: withdrawals.length,
          kyc: kyc.length,
          users: users.length,
          openTrades: trades.filter((t) => t.status === "open").length,
        });
      }
    );
  }, []);

  const links = [
    { to: "/admin/deposits", label: "Pending Deposits", icon: ArrowDownToLine, color: "text-violet-400 bg-violet-500/15", count: counts.deposits },
    { to: "/admin/withdrawals", label: "Pending Withdrawals", icon: ArrowUpFromLine, color: "text-orange-400 bg-orange-500/15", count: counts.withdrawals },
    { to: "/admin/kyc", label: "Pending KYC", icon: ShieldQuestion, color: "text-purple-400 bg-purple-500/15", count: counts.kyc },
    { to: "/admin/users", label: "Users", icon: Users, color: "text-blue-400 bg-blue-500/15", count: counts.users },
    { to: "/admin/trades", label: "Open Trades", icon: LineChart, color: "text-pink-400 bg-pink-500/15", count: counts.openTrades },
    { to: "/admin/content", label: "Content", icon: Newspaper, color: "text-amber-400 bg-amber-500/15" },
    { to: "/admin/settings", label: "Platform Settings", icon: SettingsIcon, color: "text-slate-400 bg-slate-500/15" },
  ];

  return (
    <>
      <PageHeader icon={<ShieldCheck size={20} />} title="Admin" subtitle={`Signed in as ${profile?.name} (admin)`} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((l) => (
          <Link key={l.to} to={l.to}>
            <Panel className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className={`p-2.5 rounded-xl ${l.color}`}>
                <l.icon size={18} />
              </div>
              <p className={`font-semibold text-sm flex-1 ${textPrimary}`}>{l.label}</p>
              {l.count !== undefined && l.count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">{l.count}</span>
              )}
            </Panel>
          </Link>
        ))}
      </div>
    </>
  );
}
