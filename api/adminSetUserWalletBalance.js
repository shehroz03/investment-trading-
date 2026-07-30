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

  const { uid: targetUid, newAvailable, delta } = body;
  if (typeof targetUid !== "string" || !targetUid) throw new HttpError(400, "Invalid target user id.");
  if (typeof newAvailable !== "number" || newAvailable < 0) throw new HttpError(400, "Invalid new balance.");
  if (typeof delta !== "number") throw new HttpError(400, "Invalid delta.");

  const { error: updateError } = await supabase
    .from("wallets")
    .update({ available: newAvailable })
    .eq("user_id", targetUid);

  if (updateError) throw new HttpError(500, "Failed to update wallet balance.");

  if (delta !== 0) {
    await supabase.from("transactions").insert({
      uid: targetUid,
      type: "admin_balance_adjustment",
      amount: delta,
      note: "Admin Available Balance adjustment",
      "createdAt": new Date().toISOString(),
    });
  }

  return { ok: true };
});
