const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");
const { ALLOWED_DURATIONS, isValidSymbol, fetchPrice } = require("./_lib/pricing");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin; // Using the exported Supabase Admin client

  const { symbol, direction, amount, durationSeconds, stopLoss, takeProfit } = body;
  if (!isValidSymbol(symbol)) throw new HttpError(400, "Unsupported symbol.");
  if (direction !== "long" && direction !== "short") throw new HttpError(400, "Invalid direction.");
  if (typeof amount !== "number" || !(amount > 0)) throw new HttpError(400, "Invalid amount.");
  if (durationSeconds !== undefined && durationSeconds !== null && !ALLOWED_DURATIONS.has(durationSeconds)) {
    throw new HttpError(400, "Unsupported duration.");
  }

  function isValidLevel(v) {
    return v === undefined || v === null || (typeof v === "number" && Number.isFinite(v) && v > 0);
  }
  if (!isValidLevel(stopLoss)) throw new HttpError(400, "Invalid stop loss.");
  if (!isValidLevel(takeProfit)) throw new HttpError(400, "Invalid take profit.");

  const entryPrice = await fetchPrice(symbol);
  const expiresAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000).toISOString() : null;

  // Direction-sanity check against the real, just-fetched entry price — catches a SL/TP
  // set on the wrong side of entry (client bug, or a stale price the client validated
  // against before this request landed).
  if (stopLoss != null || takeProfit != null) {
    if (direction === "long") {
      if (stopLoss != null && !(stopLoss < entryPrice)) throw new HttpError(400, "Stop loss must be below the entry price for a long position.");
      if (takeProfit != null && !(takeProfit > entryPrice)) throw new HttpError(400, "Take profit must be above the entry price for a long position.");
    } else {
      if (stopLoss != null && !(stopLoss > entryPrice)) throw new HttpError(400, "Stop loss must be above the entry price for a short position.");
      if (takeProfit != null && !(takeProfit < entryPrice)) throw new HttpError(400, "Take profit must be below the entry price for a short position.");
    }
  }

  // 1. Fetch user's wallet
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("available, locked, demo_available, demo_locked")
    .eq("user_id", uid)
    .single();

  if (walletError || !wallet) {
    throw new HttpError(400, "Wallet not found.");
  }

  const available = wallet.available || 0;
  const locked = wallet.locked || 0;
  const demo_available = wallet.demo_available || 0;
  const demo_locked = wallet.demo_locked || 0;
  
  const isDemo = !!body.is_demo;

  if (isDemo) {
    if (amount > demo_available) throw new HttpError(400, "Amount exceeds your demo balance.");
  } else {
    if (amount > available) throw new HttpError(400, "Amount exceeds your available balance.");
  }

  // 2. Deduct amount from available and add to locked
  const updateData = isDemo 
    ? { demo_available: demo_available - amount, demo_locked: demo_locked + amount }
    : { available: available - amount, locked: locked + amount };

  const { error: updateError } = await supabase
    .from("wallets")
    .update(updateData)
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
      "openedAt": new Date().toISOString(),
      is_demo: isDemo,
      "stopLoss": stopLoss ?? null,
      "takeProfit": takeProfit ?? null
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
