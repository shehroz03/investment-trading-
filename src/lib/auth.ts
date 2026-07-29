import { supabase } from "@/lib/supabase";

interface SignUpParams {
  name: string;
  username: string;
  email: string;
  password: string;
}

export async function signUp({ name, username, email, password }: SignUpParams) {
  // 1. Create the user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        username,
      }
    }
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("User creation failed.");

  const uid = authData.user.id;

  // 2. Insert into public.users table
  const { error: userError } = await supabase.from('users').insert({
    id: uid,
    name,
    username,
    email,
    role: "user",
    kyc_status: "none",
    vip_status: "none",
    credit_score: 50,
    profile_completion_percent: 0,
    // createdAt is usually handled by the database default (now()) in Supabase
  });

  if (userError) {
    console.error("Error creating user record:", userError);
    // Ideally, we'd want to rollback auth user creation or handle it via a database trigger instead
  }

  // 3. Insert into public.wallets table
  const { error: walletError } = await supabase.from('wallets').insert({
    user_id: uid,
    available: 0,
    locked: 0,
    demo_available: 1000,
    demo_locked: 0,
    pending: 0,
    "pendingOrder": 0,
    "unlockTarget": null,
    "firstTradePlaced": false,
    "totalDeposits": 0,
    "totalWithdrawals": 0,
    "totalEarnings": 0,
    // lastInterestAt usually handled by db default
  });

  if (walletError) {
    console.error("Error creating wallet record:", walletError);
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
