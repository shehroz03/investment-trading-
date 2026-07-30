import { useEffect, useState } from "react";
import { Users, Save, KeyRound } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import {
  getAllUsers,
  setUserProfileStats,
  getAllWallets,
  setUserWalletBalance,
  setUnlockTarget,
  setUserPendingOrderBalance,
  setUserLockedBalance,
  type WalletSummary,
} from "@/lib/admin";
import { ChangePasswordModal } from "@/app/components/ChangePasswordModal";
import type { UserProfile } from "@/app/context/AuthContext";

interface StatsEdit {
  creditScore: number;
  profileCompletionPercent: number;
  balance: number;
  pendingOrderBalance: number;
  lockedBalance: number;
  // 0 means "no unlock target set" — matches the plain-number input pattern used elsewhere in this table.
  unlockTarget: number;
}

export default function AdminUsers() {
  const { textPrimary, textMuted, divider, theadBg, inputBg, hoverBg } = useThemeClasses();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [wallets, setWallets] = useState<Record<string, WalletSummary>>({});
  const [search, setSearch] = useState("");
  const [statsEdits, setStatsEdits] = useState<Record<string, StatsEdit>>({});
  const [savingStatsUid, setSavingStatsUid] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserProfile | null>(null);

  const load = () => Promise.all([getAllUsers().then(setUsers), getAllWallets().then(setWallets)]);

  useEffect(() => {
    load();
  }, []);

  const getStats = (u: UserProfile): StatsEdit =>
    statsEdits[u.uid] ?? {
      creditScore: u.creditScore ?? 0,
      profileCompletionPercent: u.profileCompletionPercent ?? 0,
      balance: wallets[u.uid]?.available ?? 0,
      pendingOrderBalance: wallets[u.uid]?.pendingOrder ?? 0,
      lockedBalance: wallets[u.uid]?.locked ?? 0,
      unlockTarget: wallets[u.uid]?.unlockTarget ?? 0,
    };

  const updateStatsEdit = (u: UserProfile, field: keyof StatsEdit, value: number) => {
    setStatsEdits((prev) => ({ ...prev, [u.uid]: { ...getStats(u), [field]: value } }));
  };

  const clampStats = (stats: StatsEdit): StatsEdit => ({
    creditScore: Math.min(100, Math.max(1, Math.round(stats.creditScore))),
    profileCompletionPercent: Math.min(100, Math.max(0, Math.round(stats.profileCompletionPercent))),
    balance: Math.max(0, stats.balance),
    pendingOrderBalance: Math.max(0, stats.pendingOrderBalance),
    lockedBalance: Math.max(0, stats.lockedBalance),
    unlockTarget: Math.max(0, stats.unlockTarget),
  });

  const saveStats = async (u: UserProfile) => {
    setSavingStatsUid(u.uid);
    try {
      const stats = clampStats(getStats(u));
      await setUserProfileStats(u.uid, { creditScore: stats.creditScore, profileCompletionPercent: stats.profileCompletionPercent });
      const previousBalance = wallets[u.uid]?.available ?? 0;
      if (stats.balance !== previousBalance) {
        await setUserWalletBalance(u.uid, stats.balance, previousBalance);
      }
      const previousPendingOrder = wallets[u.uid]?.pendingOrder ?? 0;
      if (stats.pendingOrderBalance !== previousPendingOrder) {
        await setUserPendingOrderBalance(u.uid, stats.pendingOrderBalance, previousPendingOrder);
      }
      const previousLocked = wallets[u.uid]?.locked ?? 0;
      if (stats.lockedBalance !== previousLocked) {
        await setUserLockedBalance(u.uid, stats.lockedBalance, previousLocked);
      }
      const previousUnlockTarget = wallets[u.uid]?.unlockTarget ?? 0;
      if (stats.unlockTarget !== previousUnlockTarget) {
        await setUnlockTarget(u.uid, stats.unlockTarget > 0 ? stats.unlockTarget : null);
      }
      await load();
      setStatsEdits((prev) => {
        const next = { ...prev };
        delete next[u.uid];
        return next;
      });
    } finally {
      setSavingStatsUid(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toDate = (u: UserProfile) => (u.createdAt as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(0);

  return (
    <>
      <PageHeader icon={<Users size={20} />} title="Users" subtitle={`${users.length} registered accounts`} />

      <Panel className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-inherit">
          <input
            placeholder="Search by name, username, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full sm:w-80 px-3 py-2 rounded-lg border text-sm outline-none focus:border-violet-500 ${inputBg}`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wider ${theadBg}`}>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Username</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">KYC</th>
                <th className="text-left px-5 py-3">VIP</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Ref. Code</th>
                <th className="text-left px-5 py-3">Referred By</th>
                <th className="text-left px-5 py-3">Credit Score</th>
                <th className="text-left px-5 py-3">Profile %</th>
                <th className="text-left px-5 py-3">Total Money</th>
                <th className="text-left px-5 py-3">Pending Order Balance</th>
                <th className="text-left px-5 py-3">Locked Balance</th>
                <th className="text-left px-5 py-3">Unlock Target</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} className={`text-center py-10 text-sm ${textMuted}`}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.uid} className={`text-sm border-t ${divider}`}>
                    <td className={`px-5 py-3 ${textPrimary}`}>{u.name}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>{u.username}</td>
                    <td className={`px-5 py-3 ${textMuted}`}>{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.kycStatus === "approved" ? "bg-green-500/15 text-green-400" : "bg-slate-500/15 text-slate-400"}`}>
                        {u.kycStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.vipStatus === "approved" ? "bg-amber-500/15 text-amber-500" : "bg-slate-500/15 text-slate-400"}`}>
                        {u.vipStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-violet-500/15 text-violet-400" : "bg-slate-500/15 text-slate-400"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className={`px-5 py-3 font-mono text-xs ${textPrimary}`}>
                      {u.referralCode || "—"}
                    </td>
                    <td className={`px-5 py-3 font-mono text-xs ${textPrimary}`}>
                      {u.referredBy || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={getStats(u).creditScore}
                        onChange={(e) => updateStatsEdit(u, "creditScore", Number(e.target.value))}
                        className={`w-20 px-2 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={getStats(u).profileCompletionPercent}
                        onChange={(e) => updateStatsEdit(u, "profileCompletionPercent", Number(e.target.value))}
                        className={`w-16 px-2 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <span className={textMuted}>$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={getStats(u).balance}
                          onChange={(e) => updateStatsEdit(u, "balance", Number(e.target.value))}
                          className={`w-24 px-2 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <span className={textMuted}>$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          title="Deposited here to recover Locked Balance dollar-for-dollar — an admin-set alternative to the 'Recover Locked Balance' deposit request"
                          value={getStats(u).pendingOrderBalance}
                          onChange={(e) => updateStatsEdit(u, "pendingOrderBalance", Number(e.target.value))}
                          className={`w-24 px-2 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <span className={textMuted}>$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          title="Balance held against this user's open trade, or manually locked"
                          value={getStats(u).lockedBalance}
                          onChange={(e) => updateStatsEdit(u, "lockedBalance", Number(e.target.value))}
                          className={`w-24 px-2 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <span className={textMuted}>$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="none"
                          title="Available balance the user must reach before their locked balance auto-unlocks"
                          value={getStats(u).unlockTarget || ""}
                          onChange={(e) => updateStatsEdit(u, "unlockTarget", Number(e.target.value))}
                          className={`w-24 px-2 py-1.5 rounded-lg border text-sm outline-none ${inputBg}`}
                        />
                      </div>
                    </td>
                    <td className={`px-5 py-3 ${textMuted}`}>{toDate(u).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => saveStats(u)}
                          disabled={savingStatsUid === u.uid}
                          title="Save credit score / profile % / total money"
                          className={`p-1.5 rounded-lg disabled:opacity-40 ${hoverBg} ${textMuted}`}
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => setPasswordTarget(u)}
                          title="Change this user's password"
                          className={`p-1.5 rounded-lg ${hoverBg} text-violet-400`}
                        >
                          <KeyRound size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {passwordTarget && (
        <ChangePasswordModal uid={passwordTarget.uid} name={passwordTarget.name} onClose={() => setPasswordTarget(null)} />
      )}
    </>
  );
}
