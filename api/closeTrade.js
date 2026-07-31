const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");
const { fetchPrice } = require("./_lib/pricing");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin; // Using the exported Supabase Admin client

  const ALLOWED_CLOSE_REASONS = new Set(["manual", "duration", "stop_loss", "take_profit"]);
  const { tradeId, reason } = body;
  if (typeof tradeId !== "string" || !tradeId) throw new HttpError(400, "Invalid trade id.");

  // 1. Fetch trade
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .single();

  if (tradeError || !trade) throw new HttpError(404, "Trade not found.");
  if (trade.uid !== uid) throw new HttpError(403, "Not your trade.");
  if (trade.status !== "open") throw new HttpError(400, "Trade is already closed.");
  if (trade.frozen) throw new HttpError(400, "This trade is frozen by an admin and cannot be closed.");

  const closePrice = await fetchPrice(trade.symbol);
  let pnl;
  if (trade.adminOutcome === "win" || trade.adminOutcome === "loss") {
    if (trade.adminOutcome === "win") {
      const profitPercent = trade.amount > 1000 ? 0.4 : 0.3;
      pnl = trade.amount * profitPercent;
    } else {
      pnl = -trade.amount;
    }
  } else {
    const rawPercent =
      trade.direction === "long"
        ? (closePrice - trade.entryPrice) / trade.entryPrice
        : (trade.entryPrice - closePrice) / trade.entryPrice;
    pnl = Math.max(-trade.amount, trade.amount * rawPercent);
  }

  // 2. Fetch wallet
  const { data: walletData, error: walletError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", uid)
    .single();

  if (walletError || !walletData) throw new HttpError(400, "Wallet not found.");

  const isAdminWin = trade.adminOutcome === "win";
  const lostAmount = Math.max(0, -pnl);
  const marginLockedDelta = -trade.amount;
  const proceeds = trade.amount + pnl;

  const currentAvailable = walletData.available || 0;
  const currentLocked = walletData.locked || 0;
  const demoAvailable = walletData.demo_available || 0;
  const demoLocked = walletData.demo_locked || 0;
  
  const isDemo = trade.is_demo;

  let newLocked = currentLocked;
  let newAvailable = currentAvailable;
  let newDemoLocked = demoLocked;
  let newDemoAvailable = demoAvailable;
  
  let newUnlockTarget = walletData.unlockTarget;
  let unlockedAmount = 0;

  if (isDemo) {
    newDemoLocked = demoLocked + marginLockedDelta + lostAmount;
    newDemoAvailable = demoAvailable + proceeds;
  } else {
    newLocked = currentLocked + marginLockedDelta + lostAmount;
    newAvailable = currentAvailable + proceeds;
    
    if (isAdminWin) {
      const shouldUnlock = newUnlockTarget != null && newLocked > 0 && newAvailable >= newUnlockTarget;
      if (shouldUnlock) {
        unlockedAmount = newLocked;
        newAvailable = newAvailable + newLocked;
        newLocked = 0;
        newUnlockTarget = null;
      }
    }
  }

  // 3. Update wallet
  const walletUpdate = isDemo 
    ? { demo_locked: newDemoLocked, demo_available: newDemoAvailable }
    : { locked: newLocked, available: newAvailable, "unlockTarget": newUnlockTarget };

  const { error: updateWalletError } = await supabase
    .from("wallets")
    .update(walletUpdate)
    .eq("user_id", uid);

  if (updateWalletError) throw new HttpError(500, "Failed to update wallet.");

  // 4. Update trade
  await supabase
    .from("trades")
    .update({
      status: "closed",
      "closePrice": closePrice,
      pnl: pnl,
      "closedAt": new Date().toISOString(),
      "closeReason": ALLOWED_CLOSE_REASONS.has(reason) ? reason : "manual"
    })
    .eq("id", tradeId);

  // 5. Create transactions ONLY if not demo
  if (!isDemo) {
    await supabase.from("transactions").insert({
      uid,
      type: "trade_pnl",
      amount: pnl,
      note: `${trade.direction === "long" ? "Long" : "Short"} ${trade.symbol} closed`,
      "createdAt": new Date().toISOString()
    });

    if (lostAmount > 0) {
      await supabase.from("transactions").insert({
        uid,
        type: "order_lock",
        amount: lostAmount,
        note: "Balance locked after trade loss",
        "createdAt": new Date().toISOString()
      });
    }

    if (unlockedAmount > 0) {
      await supabase.from("transactions").insert({
        uid,
        type: "balance_unlock",
        amount: unlockedAmount,
        note: "Locked balance unlocked into Available Balance",
        "createdAt": new Date().toISOString()
      });
    }
  }

  return { closePrice, pnl };
});
