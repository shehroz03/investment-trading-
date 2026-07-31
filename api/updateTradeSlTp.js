const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin;

  const { tradeId, stopLoss, takeProfit } = body;
  if (typeof tradeId !== "string" || !tradeId) throw new HttpError(400, "Invalid trade id.");

  function isValidLevel(v) {
    return v === undefined || v === null || (typeof v === "number" && Number.isFinite(v) && v > 0);
  }
  if (!isValidLevel(stopLoss)) throw new HttpError(400, "Invalid stop loss.");
  if (!isValidLevel(takeProfit)) throw new HttpError(400, "Invalid take profit.");

  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select('uid, direction, "entryPrice", status, frozen')
    .eq("id", tradeId)
    .single();

  if (tradeError || !trade) throw new HttpError(404, "Trade not found.");
  if (trade.uid !== uid) throw new HttpError(403, "Not your trade.");
  if (trade.status !== "open") throw new HttpError(400, "Trade is already closed.");
  if (trade.frozen) throw new HttpError(400, "This trade is frozen by an admin.");

  if (stopLoss != null || takeProfit != null) {
    if (trade.direction === "long") {
      if (stopLoss != null && !(stopLoss < trade.entryPrice)) throw new HttpError(400, "Stop loss must be below the entry price for a long position.");
      if (takeProfit != null && !(takeProfit > trade.entryPrice)) throw new HttpError(400, "Take profit must be above the entry price for a long position.");
    } else {
      if (stopLoss != null && !(stopLoss > trade.entryPrice)) throw new HttpError(400, "Stop loss must be above the entry price for a short position.");
      if (takeProfit != null && !(takeProfit < trade.entryPrice)) throw new HttpError(400, "Take profit must be below the entry price for a short position.");
    }
  }

  const { error: updateError } = await supabase
    .from("trades")
    .update({ "stopLoss": stopLoss ?? null, "takeProfit": takeProfit ?? null })
    .eq("id", tradeId);

  if (updateError) throw new HttpError(500, "Failed to update stop loss / take profit.");

  return { ok: true };
});
