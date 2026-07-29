import { supabase } from "@/lib/supabase";
import { getAppConfig } from "@/lib/config";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { callTradingApi } from "@/lib/trading"; // We'll route complex transactions through the API

export type DepositPurpose = "wallet" | "investment" | "order";

interface CreateDepositParams {
  uid: string;
  amount: number;
  method: string;
  proofFile: File;
  purpose: DepositPurpose;
  plan?: string;
}

export async function createDepositRequest({
  uid,
  amount,
  method,
  proofFile,
  purpose,
  plan,
}: CreateDepositParams) {
  const proofUrl = await uploadToCloudinary(proofFile, `deposit-proofs/${uid}`);

  const { error } = await supabase.from('deposits').insert({
    uid,
    amount,
    method,
    proofUrl,
    purpose,
    plan: plan ?? null,
    status: "pending",
  });

  if (error) throw error;
}

export const NON_VIP_WITHDRAW_CAP = 5000;

interface CreateWithdrawParams {
  uid: string;
  amount: number;
  method: string;
  destination: string;
}

export async function createWithdrawRequest({ uid, amount, method, destination }: CreateWithdrawParams) {
  // We route this through the trading API to ensure atomicity and proper balance checks server-side
  await callTradingApi<{ ok: boolean }>("createWithdrawRequest", {
    uid,
    amount,
    method,
    destination
  });
}

export async function approveDeposit(depositId: string, reviewedBy: string) {
  // Route through API for transaction safety
  await callTradingApi<{ ok: boolean }>("approveDeposit", { depositId, reviewedBy });
}

export async function rejectDeposit(depositId: string, reviewedBy: string) {
  const { error } = await supabase
    .from('deposits')
    .update({
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedBy,
    })
    .eq('id', depositId);

  if (error) throw error;
}

export async function approveWithdrawal(withdrawalId: string, reviewedBy: string) {
  // Route through API for transaction safety
  await callTradingApi<{ ok: boolean }>("approveWithdrawal", { withdrawalId, reviewedBy });
}

export async function rejectWithdrawal(withdrawalId: string, reviewedBy: string) {
  // Route through API for transaction safety
  await callTradingApi<{ ok: boolean }>("rejectWithdrawal", { withdrawalId, reviewedBy });
}
