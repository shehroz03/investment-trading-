const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin;

  const { data: caller, error: callerError } = await supabase
    .from("users")
    .select("role")
    .eq("id", uid)
    .single();

  if (callerError || !caller || caller.role !== "admin") {
    throw new HttpError(403, "Admin only.");
  }

  const { withdrawalId, reviewedBy } = body;
  if (typeof withdrawalId !== "string" || !withdrawalId) throw new HttpError(400, "Invalid withdrawal id.");

  const { data: withdrawal, error: withdrawalError } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("id", withdrawalId)
    .single();

  if (withdrawalError || !withdrawal) throw new HttpError(404, "Withdrawal not found.");
  if (withdrawal.status !== "pending") throw new HttpError(400, "Withdrawal is already reviewed.");

  // Funds were already deducted from available when the request was created
  // (see createWithdrawRequest.js) — approval just finalizes the request and
  // records the total, it doesn't move any more balance.
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("\"totalWithdrawals\"")
    .eq("user_id", withdrawal.uid)
    .single();

  if (walletError || !wallet) throw new HttpError(400, "Wallet not found.");

  const { error: updateWalletError } = await supabase
    .from("wallets")
    .update({ "totalWithdrawals": (wallet.totalWithdrawals || 0) + withdrawal.amount })
    .eq("user_id", withdrawal.uid);

  if (updateWalletError) throw new HttpError(500, "Failed to update wallet.");

  const { error: updateWithdrawalError } = await supabase
    .from("withdrawals")
    .update({
      status: "approved",
      "reviewedAt": new Date().toISOString(),
      "reviewedBy": reviewedBy ?? uid,
    })
    .eq("id", withdrawalId);

  if (updateWithdrawalError) throw new HttpError(500, "Failed to update withdrawal status.");

  await supabase.from("transactions").insert({
    uid: withdrawal.uid,
    type: "withdrawal",
    amount: -withdrawal.amount,
    note: `Withdrawal approved (${withdrawal.method})`,
    "createdAt": new Date().toISOString(),
  });

  return { ok: true };
});
