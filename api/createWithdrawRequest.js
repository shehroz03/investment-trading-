const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

const NON_VIP_WITHDRAW_CAP = 5000;

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin;

  const { amount, method, destination } = body;
  if (typeof amount !== "number" || !(amount > 0)) throw new HttpError(400, "Invalid amount.");
  if (typeof method !== "string" || !method) throw new HttpError(400, "Invalid method.");
  if (typeof destination !== "string" || !destination) throw new HttpError(400, "Invalid destination.");

  const { data: caller, error: callerError } = await supabase
    .from("users")
    .select("vip_status")
    .eq("id", uid)
    .single();

  if (callerError || !caller) throw new HttpError(400, "User not found.");
  if (amount > NON_VIP_WITHDRAW_CAP && caller.vip_status !== "approved") {
    throw new HttpError(400, `Withdrawals above $${NON_VIP_WITHDRAW_CAP} require an approved VIP activation.`);
  }

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("available")
    .eq("user_id", uid)
    .single();

  if (walletError || !wallet) throw new HttpError(400, "Wallet not found.");
  const available = wallet.available || 0;
  if (amount > available) throw new HttpError(400, "Amount exceeds your available balance.");

  // Reserve the funds immediately so the same balance can't be withdrawn twice while pending.
  const { error: updateError } = await supabase
    .from("wallets")
    .update({ available: available - amount })
    .eq("user_id", uid);

  if (updateError) throw new HttpError(500, "Failed to reserve balance.");

  const { data: withdrawal, error: withdrawalError } = await supabase
    .from("withdrawals")
    .insert({
      uid,
      amount,
      method,
      destination,
      status: "pending",
      "createdAt": new Date().toISOString(),
    })
    .select()
    .single();

  if (withdrawalError || !withdrawal) {
    // Roll back the reservation since the request row failed to create.
    await supabase.from("wallets").update({ available }).eq("user_id", uid);
    throw new HttpError(500, "Failed to create withdrawal request.");
  }

  return { ok: true };
});
