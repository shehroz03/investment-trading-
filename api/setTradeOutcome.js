const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin;

  // Check admin role
  const { data: caller, error: callerError } = await supabase
    .from("users")
    .select("role")
    .eq("id", uid)
    .single();

  if (callerError || !caller || caller.role !== "admin") {
    throw new HttpError(403, "Admin only.");
  }

  const { tradeId, outcome } = body;
  if (typeof tradeId !== "string" || !tradeId) throw new HttpError(400, "Invalid trade id.");
  if (outcome !== "win" && outcome !== "loss") throw new HttpError(400, "Outcome must be 'win' or 'loss'.");

  // Fetch trade
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("status")
    .eq("id", tradeId)
    .single();

  if (tradeError || !trade) throw new HttpError(404, "Trade not found.");
  if (trade.status !== "open") throw new HttpError(400, "Trade is already closed.");

  // Update trade
  const { error: updateError } = await supabase
    .from("trades")
    .update({
      "adminOutcome": outcome,
      "adminOutcomeBy": uid,
      "adminOutcomeAt": new Date().toISOString()
    })
    .eq("id", tradeId);

  if (updateError) throw new HttpError(500, "Failed to update trade outcome.");

  return { ok: true };
});
