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
  // The trade's own margin releases from Locked on close. On a loss specifically, the lost
  // amount is removed from the account (it doesn't return anywhere), and whatever is left
  // over in Available Balance after that removal sweeps entirely into Locked Balance —
  // Available always ends at $0 on a loss. E.g. available=2500, a 1500 loss: 2500-1500=1000
  // sweeps to Locked, available becomes 0.
  const marginLockedDelta = -trade.amount;
  const proceeds = trade.amount + pnl; // non-lost portion of the stake, returned as usual

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const walletData = walletSnap.data() ?? {};
    const walletUpdate = { locked: FieldValue.increment(marginLockedDelta) };
    let unlockedAmount = 0;
    let sweptToLocked = 0;

    if (isAdminWin) {
      // A confirmed admin win pays out as real, withdrawable earnings instead of recycling
      // back into the tradable Pending Order Balance. Like every other path that can raise
      // `available` (see creditAvailableInTransaction in src/lib/wallet.ts), it must also
      // check whether this credit reaches an admin-set unlockTarget and sweep accordingly.
      const currentAvailable = walletData.available ?? 0;
      const currentLocked = walletData.locked ?? 0;
      const unlockTarget = walletData.unlockTarget ?? null;
      const newAvailable = currentAvailable + proceeds;
      const lockedAfterRelease = currentLocked + marginLockedDelta;
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

      if (lostAmount > 0) {
        const currentAvailable = walletData.available ?? 0;
        sweptToLocked = Math.max(0, currentAvailable - lostAmount);
        walletUpdate.available = 0;
        walletUpdate.locked = FieldValue.increment(marginLockedDelta + sweptToLocked);
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
    if (sweptToLocked > 0) {
      tx.set(db.collection("transactions").doc(), {
        uid,
        type: "order_lock",
        amount: sweptToLocked,
        note: "Available balance locked after trade loss",
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
