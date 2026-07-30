const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin;

  const { amount } = body;

  if (typeof amount !== "number" || isNaN(amount)) {
    throw new HttpError(400, "Invalid amount.");
  }

  if (amount < 1 || amount > 500000) {
    throw new HttpError(400, "Demo balance must be between $1 and $500,000.");
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

  // Update demo balance
  const { error: updateError } = await supabase
    .from("wallets")
    .update({ demo_available: amount })
    .eq("user_id", uid);

  if (updateError) {
    throw new HttpError(500, `Failed to update demo balance: ${updateError.message}`);
  }

  return { success: true, demo_available: amount };
});
