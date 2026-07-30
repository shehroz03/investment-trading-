import { supabase } from "@/lib/supabase";

export interface ReferralRecord {
  id: string;
  referrer_uid: string;
  referred_uid: string;
  referral_code: string;
  level: 1 | 2;
  commission_percent: number;
  commission_amount: number;
  source: "signup" | "deposit";
  created_at: string;
  // Joined from users table
  referred_username?: string;
  referred_name?: string;
}

export interface ReferralStats {
  totalReferrals: number;
  level1Count: number;
  level2Count: number;
  totalEarned: number;
}

/** Fetch all referrals where the user is the referrer */
export async function getMyReferrals(uid: string): Promise<ReferralRecord[]> {
  const { data, error } = await supabase
    .from("referrals")
    .select(`
      *,
      referred_user:users!referrals_referred_uid_fkey(username, name)
    `)
    .eq("referrer_uid", uid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching referrals:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    ...r,
    referred_username: r.referred_user?.username ?? "—",
    referred_name: r.referred_user?.name ?? "—",
  }));
}

/** Aggregate stats for a user's referrals */
export async function getReferralStats(uid: string): Promise<ReferralStats> {
  const referrals = await getMyReferrals(uid);

  const level1 = referrals.filter((r) => r.level === 1);
  const level2 = referrals.filter((r) => r.level === 2);
  const totalEarned = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  // Deduplicate by referred_uid to count unique people referred
  const uniqueReferredUids = new Set(referrals.map((r) => r.referred_uid));

  return {
    totalReferrals: uniqueReferredUids.size,
    level1Count: new Set(level1.map((r) => r.referred_uid)).size,
    level2Count: new Set(level2.map((r) => r.referred_uid)).size,
    totalEarned,
  };
}

/** Get a user's referral code from their profile */
export async function getMyReferralCode(uid: string): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("referral_code")
    .eq("id", uid)
    .single();
  return data?.referral_code ?? null;
}

/** Validate a referral code — returns true if it exists and belongs to a different user */
export async function validateReferralCode(
  code: string,
  currentUid?: string
): Promise<boolean> {
  if (!code || code.trim().length !== 6) return false;
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("referral_code", code.trim().toUpperCase())
    .maybeSingle();
  if (!data) return false;
  if (currentUid && data.id === currentUid) return false; // Can't refer yourself
  return true;
}
