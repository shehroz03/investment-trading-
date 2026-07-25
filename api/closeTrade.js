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
  const isAdminWin = trade.adminOutcome === "win";
  const lostAmount = Math.max(0, -pnl);
  // Trades now open by deducting from and close by returning to Available Balance directly
  // (Pending Order Balance is no longer trade-related — see creditPendingOrderAndRecoverLocked
  // in src/lib/wallet.ts for its new role). On a loss, only the lost portion stays behind in
  // Locked Balance; the rest of the margin releases back to Available as usual.
  const marginLockedDelta = -trade.amount;
  const proceeds = trade.amount + pnl; // non-lost portion of the stake, returned as usual

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const walletData = walletSnap.data() ?? {};
    const walletUpdate = {
      locked: FieldValue.increment(marginLockedDelta + lostAmount),
      available: FieldValue.increment(proceeds),
    };
    let unlockedAmount = 0;

    if (isAdminWin) {
      // Like every other path that can raise `available` (see creditAvailableInTransaction
      // in src/lib/wallet.ts), a confirmed admin win must also check whether this credit
      // reaches an admin-set unlockTarget and sweep the rest of Locked accordingly.
      const currentAvailable = walletData.available ?? 0;
      const currentLocked = walletData.locked ?? 0;
      const unlockTarget = walletData.unlockTarget ?? null;
      const newAvailable = currentAvailable + proceeds;
      const lockedAfterRelease = currentLocked + marginLockedDelta;
      const shouldUnlock = unlockTarget != null && lockedAfterRelease > 0 && newAvailable >= unlockTarget;

      if (shouldUnlock) {
        walletUpdate.locked = 0;
        walletUpdate.available = newAvailable + lockedAfterRelease;
        walletUpdate.unlockTarget = null;
        unlockedAmount = lockedAfterRelease;
      }
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
        note: "Locked balance unlocked into Available Balance",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { closePrice, pnl };
});
