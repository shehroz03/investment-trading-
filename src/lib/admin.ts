import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/app/context/AuthContext";
import { callTradingApi, type Trade } from "@/lib/trading";
import { creditAvailableInTransaction, creditPendingOrderAndRecoverLocked } from "@/lib/wallet";

export interface PendingDeposit {
  id: string;
  uid: string;
  amount: number;
  method: string;
  proofUrl: string;
  purpose: "wallet" | "investment" | "order";
  plan: string | null;
  createdAt: string | null;
}

export interface PendingWithdrawal {
  id: string;
  uid: string;
  amount: number;
  method: string;
  destination: string;
  createdAt: string | null;
}

export interface PendingKyc {
  uid: string;
  personalInfo: { fullName: string; dateOfBirth: string; address: string; country: string };
  idProofUrl: string;
  addressProofUrl: string;
  selfieUrl: string;
  submittedAt: string | null;
}

export interface PendingVip {
  uid: string;
  note: string;
  submittedAt: string | null;
}

export async function getPendingDeposits(): Promise<PendingDeposit[]> {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('status', 'pending')
    .order('createdAt', { ascending: true });
  if (error) throw error;
  return data as PendingDeposit[];
}

export async function getPendingWithdrawals(): Promise<PendingWithdrawal[]> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('status', 'pending')
    .order('createdAt', { ascending: true });
  if (error) throw error;
  return data as PendingWithdrawal[];
}

export async function getPendingKyc(): Promise<PendingKyc[]> {
  const { data, error } = await supabase
    .from('kyc')
    .select('*')
    .eq('status', 'pending')
    .order('submittedAt', { ascending: true });
  if (error) throw error;
  return data as PendingKyc[];
}

export async function getPendingVipRequests(): Promise<PendingVip[]> {
  const { data, error } = await supabase
    .from('vip')
    .select('*')
    .eq('status', 'pending')
    .order('submittedAt', { ascending: true });
  if (error) throw error;
  return data as PendingVip[];
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data as UserProfile[];
}

export async function setUserRole(uid: string, role: "user" | "admin"): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', uid);
  if (error) throw error;
}

export async function setUserProfileStats(
  uid: string,
  data: { creditScore: number; profileCompletionPercent: number }
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ 
      credit_score: data.creditScore, 
      profile_completion_percent: data.profileCompletionPercent 
    })
    .eq('id', uid);
  if (error) throw error;
}

export async function getAllTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('openedAt', { ascending: false });
  if (error) throw error;
  return data as Trade[];
}

export async function creditUserWallet(uid: string, amount: number, note: string): Promise<void> {
  // Ideally this should be a Supabase RPC to handle transaction safely.
  // We use an API call for admin-related transactional actions to bypass RLS safely and use server-side logic
  await callTradingApi<{ ok: boolean }>("adminCreditUserWallet", { uid, amount, note });
}

export interface WalletSummary {
  available: number;
  pendingOrder: number;
  locked: number;
  unlockTarget: number | null;
}

export async function getAllWallets(): Promise<Record<string, WalletSummary>> {
  const { data, error } = await supabase.from('wallets').select('*');
  if (error) throw error;
  
  const summaries: Record<string, WalletSummary> = {};
  data.forEach((d) => {
    summaries[d.user_id] = {
      available: d.available ?? 0,
      pendingOrder: d.pendingOrder ?? 0,
      locked: d.locked ?? 0,
      unlockTarget: d.unlockTarget ?? null,
    };
  });
  return summaries;
}

export async function setUnlockTarget(uid: string, targetAvailable: number | null): Promise<void> {
  await callTradingApi<{ ok: boolean }>("adminSetUnlockTarget", { uid, targetAvailable });
}

export async function setUserWalletBalance(uid: string, newAvailable: number, previousAvailable: number): Promise<void> {
  const delta = newAvailable - previousAvailable;
  if (delta === 0) return;
  await callTradingApi<{ ok: boolean }>("adminSetUserWalletBalance", { uid, newAvailable, delta });
}

export async function setUserPendingOrderBalance(uid: string, newPendingOrder: number, previousPendingOrder: number): Promise<void> {
  const delta = newPendingOrder - previousPendingOrder;
  if (delta === 0) return;
  await callTradingApi<{ ok: boolean }>("adminSetUserPendingOrderBalance", { uid, newPendingOrder, delta });
}

export async function setUserLockedBalance(uid: string, newLocked: number, previousLocked: number): Promise<void> {
  const delta = newLocked - previousLocked;
  if (delta === 0) return;
  
  const { error: updateError } = await supabase
    .from('wallets')
    .update({ locked: newLocked })
    .eq('user_id', uid);
  
  if (updateError) throw updateError;
  
  const { error: insertError } = await supabase
    .from('transactions')
    .insert({
      uid,
      type: "admin_locked_adjustment",
      amount: delta,
      note: "Admin Locked Balance adjustment",
    });
    
  if (insertError) throw insertError;
}

export async function setUserPassword(targetUid: string, newPassword: string): Promise<void> {
  await callTradingApi<{ ok: boolean }>("setUserPassword", { targetUid, newPassword });
}
