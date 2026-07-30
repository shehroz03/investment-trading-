const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin;

  const { amount } = body;

  if (typeof amount !== "number" || isNaN(amount)) {
    throw new HttpError(400, "Invalid amount.");
  }

  if (amount < 1 || amount > 5000000) {
    throw new HttpError(400, "Demo balance must be between $1 and $5,000,000.");
  }

  // First check if wallet exists
  const { data: wallet, error: fetchError } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", uid)
    .single();

  if (fetchError || !wallet) {
    throw new HttpError(400, "Wallet not found. Please ensure your account is properly set up.");
  }

  // Update demo balance and clear any locked demo balance from previous trades
  const { error: updateError } = await supabase
    .from("wallets")
    .update({ demo_available: amount, demo_locked: 0 })
    .eq("user_id", uid);

  if (updateError) {
    throw new HttpError(500, `Failed to update demo balance: ${updateError.message}`);
  }

  return { success: true, demo_available: amount };
});
