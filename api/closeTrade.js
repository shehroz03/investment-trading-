const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");
const { fetchPrice } = require("./_lib/pricing");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;

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
    if (trade.adminOutcome === "win") {
      // Fixed payout tiers instead of even money: bigger stakes earn a higher rate.
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
    // Losses are capped at the staked amount (can't lose more than you put in); gains are uncapped.
    pnl = Math.max(-trade.amount, trade.amount * rawPercent);
  }

  const walletRef = db.collection("wallets").doc(uid);
  // On a loss, the lost portion doesn't leave the system — it stays in Locked Balance
  // instead of the margin lock fully releasing. Verified against both extremes: a full
  // loss (pnl = -amount) nets a locked delta of 0, i.e. the already-locked stake simply
  // stays; a win (pnl >= 0) nets -amount, i.e. the full margin lock releases as before.
  const isAdminWin = trade.adminOutcome === "win";
  const lostAmount = Math.max(0, -pnl);
  const lockedDelta = -trade.amount + lostAmount;
  const proceeds = trade.amount + pnl;

  await db.runTransaction(async (tx) => {
    const walletUpdate = { locked: FieldValue.increment(lockedDelta) };
    let unlockedAmount = 0;

    if (isAdminWin) {
      // A confirmed admin win pays out as real, withdrawable earnings instead of recycling
      // back into the tradable Pending Order Balance. Like every other path that can raise
      // `available` (see creditAvailableInTransaction in src/lib/wallet.ts), it must also
      // check whether this credit reaches an admin-set unlockTarget and sweep accordingly.
      const walletSnap = await tx.get(walletRef);
      const walletData = walletSnap.data() ?? {};
      const currentAvailable = walletData.available ?? 0;
      const currentLocked = walletData.locked ?? 0;
      const unlockTarget = walletData.unlockTarget ?? null;
      const newAvailable = currentAvailable + proceeds;
      const lockedAfterRelease = currentLocked + lockedDelta;
      const shouldUnlock = unlockTarget != null && lockedAfterRelease > 0 && newAvailable >= unlockTarget;

      walletUpdate.available = newAvailable;
      if (shouldUnlock) {
        walletUpdate.locked = 0;
        walletUpdate.pendingOrder = FieldValue.increment(lockedAfterRelease);
        walletUpdate.unlockTarget = null;
        unlockedAmount = lockedAfterRelease;
      }
    } else {
      walletUpdate.pendingOrder = FieldValue.increment(proceeds);
    }

    tx.update(walletRef, walletUpdate);
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
    if (lostAmount > 0) {
      tx.set(db.collection("transactions").doc(), {
        uid,
        type: "order_lock",
        amount: lostAmount,
        note: "Balance locked after trade loss",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (unlockedAmount > 0) {
      tx.set(db.collection("transactions").doc(), {
        uid,
        type: "balance_unlock",
        amount: unlockedAmount,
        note: "Balance unlocked — moved to Pending Order Balance",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { closePrice, pnl };
});
