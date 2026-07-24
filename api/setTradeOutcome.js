const admin = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);

  const callerSnap = await db.collection("users").doc(uid).get();
  if (callerSnap.data()?.role !== "admin") throw new HttpError(403, "Admin only.");

  const { tradeId, outcome } = body;
  if (typeof tradeId !== "string" || !tradeId) throw new HttpError(400, "Invalid trade id.");
  if (outcome !== "win" && outcome !== "loss") throw new HttpError(400, "Outcome must be 'win' or 'loss'.");

  const tradeRef = db.collection("trades").doc(tradeId);
  const tradeSnap = await tradeRef.get();
  if (!tradeSnap.exists) throw new HttpError(404, "Trade not found.");
  if (tradeSnap.data().status !== "open") throw new HttpError(400, "Trade is already closed.");

  await tradeRef.update({
    adminOutcome: outcome,
    adminOutcomeBy: uid,
    adminOutcomeAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
