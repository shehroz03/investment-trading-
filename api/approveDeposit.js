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

  const { depositId, reviewedBy } = body;
  if (typeof depositId !== "string" || !depositId) throw new HttpError(400, "Invalid deposit id.");

  const { data: deposit, error: depositError } = await supabase
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .single();

  if (depositError || !deposit) throw new HttpError(404, "Deposit not found.");
  if (deposit.status !== "pending") throw new HttpError(400, "Deposit is already reviewed.");

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("available, \"pendingOrder\", \"totalDeposits\"")
    .eq("user_id", deposit.uid)
    .single();

  if (walletError || !wallet) throw new HttpError(400, "Wallet not found.");

  const available = wallet.available || 0;
  const pendingOrder = wallet.pendingOrder || 0;
  const totalDeposits = wallet.totalDeposits || 0;

  // "order" purpose deposits recover a user's locked balance via the pending-order queue
  // instead of crediting available directly — everything else credits available balance.
  const walletUpdate =
    deposit.purpose === "order"
      ? { "pendingOrder": pendingOrder + deposit.amount, "totalDeposits": totalDeposits + deposit.amount }
      : { available: available + deposit.amount, "totalDeposits": totalDeposits + deposit.amount };

  const { error: updateWalletError } = await supabase
    .from("wallets")
    .update(walletUpdate)
    .eq("user_id", deposit.uid);

  if (updateWalletError) throw new HttpError(500, "Failed to update wallet.");

  const { error: updateDepositError } = await supabase
    .from("deposits")
    .update({
      status: "approved",
      "reviewedAt": new Date().toISOString(),
      "reviewedBy": reviewedBy ?? uid,
    })
    .eq("id", depositId);

  if (updateDepositError) throw new HttpError(500, "Failed to update deposit status.");

  await supabase.from("transactions").insert({
    uid: deposit.uid,
    type: "deposit",
    amount: deposit.amount,
    note: `Deposit approved (${deposit.method})`,
    "createdAt": new Date().toISOString(),
  });

  return { ok: true };
});
