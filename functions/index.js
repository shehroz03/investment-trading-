const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const ALLOWED_DURATIONS = new Set([10, 20, 30, 60, 120, 300]);

// BTS/ETC aren't real Binance markets in these ranges — their price is a deterministic
// function of time instead of a live feed, so this mirrors src/lib/crypto.ts's
// getSimulatedPrice exactly (same formula) to stay in sync with what the client displays.
const SIMULATED_RANGES = { BTSUSDT: [3, 7], ETCUSDT: [5, 9] };

// Users can pick any coin from the "More coins" picker (any live Binance USDT market), not
// just the pinned favorites, so symbols aren't checked against a fixed list — just a shape
// that matches a real USDT trading pair. fetchPrice below still fails closed for anything
// that isn't an actual Binance market.
const SYMBOL_PATTERN = /^[A-Z0-9]{2,15}USDT$/;
function isValidSymbol(symbol) {
  return typeof symbol === "string" && (Boolean(SIMULATED_RANGES[symbol]) || SYMBOL_PATTERN.test(symbol));
}

function seedFromSymbol(symbol) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return h;
}

function getSimulatedPrice(symbol, atMs) {
  const [min, max] = SIMULATED_RANGES[symbol];
  const seed = seedFromSymbol(symbol);
  const phase1 = ((seed % 1000) / 1000) * Math.PI * 2;
  const phase2 = (((seed >> 3) % 1000) / 1000) * Math.PI * 2;
  const phase3 = (((seed >> 7) % 1000) / 1000) * Math.PI * 2;
  const t = atMs / 1000;
  const wave = 0.55 * Math.sin(t / 53 + phase1) + 0.3 * Math.sin(t / 19 + phase2) + 0.15 * Math.sin(t / 7 + phase3);
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  return mid + amp * wave;
}

async function fetchPrice(symbol) {
  if (SIMULATED_RANGES[symbol]) return getSimulatedPrice(symbol, Date.now());
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  if (!res.ok) throw new HttpsError("unavailable", "Could not fetch market price. Try again.");
  const data = await res.json();
  const price = parseFloat(data.price);
  if (!price || Number.isNaN(price)) throw new HttpsError("unavailable", "Invalid market price received.");
  return price;
}

exports.openTrade = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const { symbol, direction, amount, durationSeconds } = request.data ?? {};
  if (!isValidSymbol(symbol)) throw new HttpsError("invalid-argument", "Unsupported symbol.");
  if (direction !== "long" && direction !== "short") throw new HttpsError("invalid-argument", "Invalid direction.");
  if (typeof amount !== "number" || !(amount > 0)) throw new HttpsError("invalid-argument", "Invalid amount.");
  if (durationSeconds !== undefined && durationSeconds !== null && !ALLOWED_DURATIONS.has(durationSeconds)) {
    throw new HttpsError("invalid-argument", "Unsupported duration.");
  }

  const entryPrice = await fetchPrice(symbol);
  const walletRef = db.collection("wallets").doc(uid);
  const tradeRef = db.collection("trades").doc();
  const expiresAt = durationSeconds ? Timestamp.fromMillis(Date.now() + durationSeconds * 1000) : null;

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const available = walletSnap.data()?.available ?? 0;
    if (amount > available) throw new HttpsError("failed-precondition", "Amount exceeds available balance.");

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

exports.closeTrade = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const { tradeId } = request.data ?? {};
  if (typeof tradeId !== "string" || !tradeId) throw new HttpsError("invalid-argument", "Invalid trade id.");

  const tradeRef = db.collection("trades").doc(tradeId);
  const tradeSnap = await tradeRef.get();
  if (!tradeSnap.exists) throw new HttpsError("not-found", "Trade not found.");

  const trade = tradeSnap.data();
  if (trade.uid !== uid) throw new HttpsError("permission-denied", "Not your trade.");
  if (trade.status !== "open") throw new HttpsError("failed-precondition", "Trade is already closed.");

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

exports.setTradeOutcome = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const callerSnap = await db.collection("users").doc(uid).get();
  if (callerSnap.data()?.role !== "admin") throw new HttpsError("permission-denied", "Admin only.");

  const { tradeId, outcome } = request.data ?? {};
  if (typeof tradeId !== "string" || !tradeId) throw new HttpsError("invalid-argument", "Invalid trade id.");
  if (outcome !== "win" && outcome !== "loss") throw new HttpsError("invalid-argument", "Outcome must be 'win' or 'loss'.");

  const tradeRef = db.collection("trades").doc(tradeId);
  const tradeSnap = await tradeRef.get();
  if (!tradeSnap.exists) throw new HttpsError("not-found", "Trade not found.");
  if (tradeSnap.data().status !== "open") throw new HttpsError("failed-precondition", "Trade is already closed.");

  await tradeRef.update({
    adminOutcome: outcome,
    adminOutcomeBy: uid,
    adminOutcomeAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
