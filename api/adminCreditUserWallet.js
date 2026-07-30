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

  const { uid: targetUid, amount, note } = body;
  if (typeof targetUid !== "string" || !targetUid) throw new HttpError(400, "Invalid target user id.");
  if (typeof amount !== "number" || amount === 0) throw new HttpError(400, "Invalid amount.");

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("available, \"totalEarnings\"")
    .eq("user_id", targetUid)
    .single();

  if (walletError || !wallet) throw new HttpError(400, "Target wallet not found.");

  const newAvailable = (wallet.available || 0) + amount;
  if (newAvailable < 0) throw new HttpError(400, "Credit would result in a negative balance.");

  const { error: updateError } = await supabase
    .from("wallets")
    .update({
      available: newAvailable,
      "totalEarnings": (wallet.totalEarnings || 0) + (amount > 0 ? amount : 0),
    })
    .eq("user_id", targetUid);

  if (updateError) throw new HttpError(500, "Failed to update wallet.");

  await supabase.from("transactions").insert({
    uid: targetUid,
    type: "admin_credit",
    amount,
    note: note || "Admin wallet adjustment",
    "createdAt": new Date().toISOString(),
  });

  return { ok: true };
});
