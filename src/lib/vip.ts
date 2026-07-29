import { supabase } from "@/lib/supabase";

export type VipStatus = "none" | "pending" | "approved" | "rejected";

export interface VipRecord {
  note: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string | null;
  reviewedAt?: string | null;
}

export async function submitVipRequest(uid: string, note: string): Promise<void> {
  const { error: vipError } = await supabase.from('vip').insert({
    uid,
    note,
    status: "pending",
  });
  if (vipError) throw vipError;

  const { error: userError } = await supabase.from('users').update({ vip_status: "pending" }).eq('id', uid);
  if (userError) throw userError;
}

export async function getVipRecord(uid: string): Promise<VipRecord | null> {
  const { data, error } = await supabase.from('vip').select('*').eq('uid', uid).single();
  if (error || !data) return null;
  
  return {
    note: data.note,
    status: data.status,
    submittedAt: data.submittedAt,
    reviewedAt: data.reviewedAt,
  } as VipRecord;
}

export async function reviewVipRequest(uid: string, status: "approved" | "rejected"): Promise<void> {
  const { error: vipError } = await supabase.from('vip').update({ status }).eq('uid', uid);
  if (vipError) throw vipError;

  const { error: userError } = await supabase.from('users').update({ vip_status: status }).eq('id', uid);
  if (userError) throw userError;
}
