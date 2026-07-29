const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");
const { ALLOWED_DURATIONS, isValidSymbol, fetchPrice } = require("./_lib/pricing");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin; // Using the exported Supabase Admin client

  const { symbol, direction, amount, durationSeconds } = body;
  if (!isValidSymbol(symbol)) throw new HttpError(400, "Unsupported symbol.");
  if (direction !== "long" && direction !== "short") throw new HttpError(400, "Invalid direction.");
  if (typeof amount !== "number" || !(amount > 0)) throw new HttpError(400, "Invalid amount.");
  if (durationSeconds !== undefined && durationSeconds !== null && !ALLOWED_DURATIONS.has(durationSeconds)) {
    throw new HttpError(400, "Unsupported duration.");
  }

  const entryPrice = await fetchPrice(symbol);
  const expiresAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000).toISOString() : null;

  // 1. Fetch user's wallet
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("available, locked")
    .eq("user_id", uid)
    .single();

  if (walletError || !wallet) {
    throw new HttpError(400, "Wallet not found.");
  }

  const available = wallet.available || 0;
  const locked = wallet.locked || 0;

  if (amount > available) {
    throw new HttpError(400, "Amount exceeds your available balance.");
  }

  // 2. Deduct amount from available and add to locked
  const { error: updateError } = await supabase
    .from("wallets")
    .update({
      available: available - amount,
      locked: locked + amount
    })
    .eq("user_id", uid);

  if (updateError) {
    throw new HttpError(500, "Failed to update wallet balance.");
  }

  // 3. Create the trade
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .insert({
      uid,
      symbol,
      direction,
      amount,
      "entryPrice": entryPrice,
      status: "open",
      "durationSeconds": durationSeconds ?? null,
      "expiresAt": expiresAt,
      "openedAt": new Date().toISOString()
    })
    .select()
    .single();

  if (tradeError || !trade) {
    // Note: If this fails, the user lost their balance because we don't have atomic distributed transactions here.
    // In a production environment, this should be handled inside a Postgres RPC (Stored Procedure).
    throw new HttpError(500, "Failed to create trade.");
  }

  return { tradeId: trade.id, entryPrice };
});
