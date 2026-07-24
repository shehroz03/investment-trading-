const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");
const { ALLOWED_DURATIONS, isValidSymbol, fetchPrice } = require("./_lib/pricing");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const db = admin.firestore();
  const { FieldValue, Timestamp } = admin.firestore;

  const { symbol, direction, amount, durationSeconds } = body;
  if (!isValidSymbol(symbol)) throw new HttpError(400, "Unsupported symbol.");
  if (direction !== "long" && direction !== "short") throw new HttpError(400, "Invalid direction.");
  if (typeof amount !== "number" || !(amount > 0)) throw new HttpError(400, "Invalid amount.");
  if (durationSeconds !== undefined && durationSeconds !== null && !ALLOWED_DURATIONS.has(durationSeconds)) {
    throw new HttpError(400, "Unsupported duration.");
  }

  const entryPrice = await fetchPrice(symbol);
  const walletRef = db.collection("wallets").doc(uid);
  const tradeRef = db.collection("trades").doc();
  const expiresAt = durationSeconds ? Timestamp.fromMillis(Date.now() + durationSeconds * 1000) : null;

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const wallet = walletSnap.data() ?? {};
    const pendingOrder = wallet.pendingOrder ?? 0;
    if (amount > pendingOrder) throw new HttpError(400, "Amount exceeds your Pending Order Balance.");

    const walletUpdate = {
      pendingOrder: FieldValue.increment(-amount),
      locked: FieldValue.increment(amount),
    };

    // One-time rule: the first trade a user ever places also sweeps whatever is left in
    // their Pending Order Balance into Locked, alongside this trade's own margin.
    const remainder = pendingOrder - amount;
    const isFirstTrade = !wallet.firstTradePlaced;
    if (isFirstTrade) {
      walletUpdate.firstTradePlaced = true;
      if (remainder > 0) {
        walletUpdate.pendingOrder = FieldValue.increment(-amount - remainder);
        walletUpdate.locked = FieldValue.increment(amount + remainder);
      }
    }

    tx.update(walletRef, walletUpdate);

    if (isFirstTrade && remainder > 0) {
      tx.set(db.collection("transactions").doc(), {
        uid,
        type: "order_lock",
        amount: remainder,
        note: "Balance locked after first trade",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(tradeRef, {
      uid,
      symbol,
      direction,
      amount,
      entryPrice,
      status: "open",
      durationSeconds: durationSeconds ?? null,
      expiresAt,
      openedAt: FieldValue.serverTimestamp(),
    });
  });

  return { tradeId: tradeRef.id, entryPrice };
});
