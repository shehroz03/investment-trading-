const { admin } = require("./_lib/admin");
const { withHandler, requireUid } = require("./_lib/http");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_RATE = 0.01;

// No cron in this project — this runs lazily whenever a user's wallet page loads (see
// accrueLockedInterest in src/lib/trading.ts), crediting whatever whole days of 1% compounding
// interest on Locked Balance have accrued since the last check.
module.exports = withHandler(async (req) => {
  const uid = await requireUid(req);
  const db = admin.firestore();
  const { FieldValue, Timestamp } = admin.firestore;

  const walletRef = db.collection("wallets").doc(uid);

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const wallet = walletSnap.data() ?? {};
    const locked = wallet.locked ?? 0;
    const lastInterestAt = wallet.lastInterestAt ?? null;
    const now = Date.now();

    // First time this field is seen for a wallet, just baseline it — no backdated credit
    // for however long the account existed before this feature shipped.
    if (!lastInterestAt) {
      tx.update(walletRef, { lastInterestAt: Timestamp.fromMillis(now) });
      return;
    }

    const daysElapsed = Math.floor((now - lastInterestAt.toMillis()) / ONE_DAY_MS);
    if (daysElapsed < 1) return;

    const advancedAt = Timestamp.fromMillis(lastInterestAt.toMillis() + daysElapsed * ONE_DAY_MS);
    if (locked <= 0) {
      tx.update(walletRef, { lastInterestAt: advancedAt });
      return;
    }

    const interest = locked * (Math.pow(1 + DAILY_RATE, daysElapsed) - 1);
    tx.update(walletRef, {
      locked: FieldValue.increment(interest),
      lastInterestAt: advancedAt,
    });
    tx.set(db.collection("transactions").doc(), {
      uid,
      type: "roi",
      amount: interest,
      note: "Daily interest on locked balance",
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
