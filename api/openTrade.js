const admin = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");
const { ALLOWED_DURATIONS, isValidSymbol, fetchPrice } = require("./_lib/pricing");

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);

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
    const available = walletSnap.data()?.available ?? 0;
    if (amount > available) throw new HttpError(400, "Amount exceeds available balance.");

    tx.update(walletRef, {
      available: FieldValue.increment(-amount),
      locked: FieldValue.increment(amount),
    });

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
