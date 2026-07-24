const admin = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");
const { fetchPrice } = require("./_lib/pricing");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);

  const { tradeId } = body;
  if (typeof tradeId !== "string" || !tradeId) throw new HttpError(400, "Invalid trade id.");

  const tradeRef = db.collection("trades").doc(tradeId);
  const tradeSnap = await tradeRef.get();
  if (!tradeSnap.exists) throw new HttpError(404, "Trade not found.");

  const trade = tradeSnap.data();
  if (trade.uid !== uid) throw new HttpError(403, "Not your trade.");
  if (trade.status !== "open") throw new HttpError(400, "Trade is already closed.");

  const closePrice = await fetchPrice(trade.symbol);
  let pnl;
  if (trade.adminOutcome === "win" || trade.adminOutcome === "loss") {
    // An admin manually decided this trade's result — pay out/forfeit the full stake
    // instead of computing PnL from price movement.
    pnl = trade.adminOutcome === "win" ? trade.amount : -trade.amount;
  } else {
    const rawPercent =
      trade.direction === "long"
        ? (closePrice - trade.entryPrice) / trade.entryPrice
        : (trade.entryPrice - closePrice) / trade.entryPrice;
    // Losses are capped at the staked amount (can't lose more than you put in); gains are uncapped.
    pnl = Math.max(-trade.amount, trade.amount * rawPercent);
  }

  const walletRef = db.collection("wallets").doc(uid);

  await db.runTransaction(async (tx) => {
    tx.update(walletRef, {
      locked: FieldValue.increment(-trade.amount),
      available: FieldValue.increment(trade.amount + pnl),
    });
    tx.update(tradeRef, {
      status: "closed",
      closePrice,
      pnl,
      closedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("transactions").doc(), {
      uid,
      type: "trade_pnl",
      amount: pnl,
      note: `${trade.direction === "long" ? "Long" : "Short"} ${trade.symbol} closed`,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { closePrice, pnl };
});
