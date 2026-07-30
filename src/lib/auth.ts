import { supabase } from "@/lib/supabase";

interface SignUpParams {
  name: string;
  username: string;
  email: string;
  password: string;
  referralCode?: string; // Optional referral code entered by new user
}

/** Generates a random 6-character uppercase alphanumeric referral code */
function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Generates a unique referral code not already taken in the DB */
async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!data) return code; // Code is unique
  }
  // Fallback: timestamp-based code
  return "R" + Date.now().toString(36).toUpperCase().slice(-5);
}

export async function signUp({ name, username, email, password, referralCode }: SignUpParams) {
  // 1. Create the user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, username },
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("User creation failed.");

  const uid = authData.user.id;

  // 2. Generate a unique referral code for the new user
  const newUserReferralCode = await generateUniqueReferralCode();

  // 3. Validate referral code (if provided) — find the referrer
  let referrerUid: string | null = null;
  let validatedReferralCode: string | null = null;

  if (referralCode && referralCode.trim().length > 0) {
    const trimmedCode = referralCode.trim().toUpperCase();
    const { data: referrerData } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", trimmedCode)
      .maybeSingle();

    if (referrerData) {
      referrerUid = referrerData.id;
      validatedReferralCode = trimmedCode;
    }
  }

  // 4. Insert into public.users table
  const { error: userError } = await supabase.from("users").insert({
    id: uid,
    name,
    username,
    email,
    role: "user",
    kyc_status: "none",
    vip_status: "none",
    credit_score: 50,
    profile_completion_percent: 0,
    referral_code: newUserReferralCode,
    referred_by: validatedReferralCode,
  });

  if (userError) {
    console.error("Error creating user record:", userError);
  }

  // 5. Insert into public.wallets table
  const { error: walletError } = await supabase.from("wallets").insert({
    user_id: uid,
    available: 0,
    locked: 0,
    demo_available: 5000000,
    demo_locked: 0,
    pending: 0,
    pendingOrder: 0,
    unlockTarget: null,
    firstTradePlaced: false,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalEarnings: 0,
  });

  if (walletError) {
    console.error("Error creating wallet record:", walletError);
  }

  // 6. Process referral commissions if a valid referral code was used
  if (referrerUid && validatedReferralCode) {
    // --- Level 1: Direct referrer gets $2 signup bonus ---
    const SIGNUP_BONUS = 2; // $2 fixed signup bonus

    // Insert referral record (Level 1)
    await supabase.from("referrals").insert({
      referrer_uid: referrerUid,
      referred_uid: uid,
      referral_code: validatedReferralCode,
      level: 1,
      commission_percent: 0,
      commission_amount: SIGNUP_BONUS,
      source: "signup",
    });

    // Add $2 to referrer's wallet
    const { data: referrerWallet } = await supabase
      .from("wallets")
      .select("available, totalEarnings")
      .eq("user_id", referrerUid)
      .single();

    if (referrerWallet) {
      await supabase
        .from("wallets")
        .update({
          available: (referrerWallet.available || 0) + SIGNUP_BONUS,
          totalEarnings: (referrerWallet.totalEarnings || 0) + SIGNUP_BONUS,
        })
        .eq("user_id", referrerUid);

      // Add transaction record for referrer
      await supabase.from("transactions").insert({
        uid: referrerUid,
        type: "referral_bonus",
        amount: SIGNUP_BONUS,
        note: `Referral signup bonus — new user joined with your code`,
      });
    }

    // --- Level 2: Find the referrer's referrer ---
    const { data: referrerProfile } = await supabase
      .from("users")
      .select("referred_by")
      .eq("id", referrerUid)
      .single();

    if (referrerProfile?.referred_by) {
      const { data: level2Referrer } = await supabase
        .from("users")
        .select("id")
        .eq("referral_code", referrerProfile.referred_by)
        .maybeSingle();

      if (level2Referrer) {
        const LEVEL2_BONUS = 1; // $1 for level 2

        await supabase.from("referrals").insert({
          referrer_uid: level2Referrer.id,
          referred_uid: uid,
          referral_code: validatedReferralCode,
          level: 2,
          commission_percent: 0,
          commission_amount: LEVEL2_BONUS,
          source: "signup",
        });

        const { data: l2Wallet } = await supabase
          .from("wallets")
          .select("available, totalEarnings")
          .eq("user_id", level2Referrer.id)
          .single();

        if (l2Wallet) {
          await supabase
            .from("wallets")
            .update({
              available: (l2Wallet.available || 0) + LEVEL2_BONUS,
              totalEarnings: (l2Wallet.totalEarnings || 0) + LEVEL2_BONUS,
            })
            .eq("user_id", level2Referrer.id);

          await supabase.from("transactions").insert({
            uid: level2Referrer.id,
            type: "referral_bonus",
            amount: LEVEL2_BONUS,
            note: `Level 2 referral bonus — indirect signup via your network`,
          });
        }
      }
    }
  }

  return authData.user;
}

export async function logIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data.user;
}

export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
