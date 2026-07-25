const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;

  const callerSnap = await db.collection("users").doc(uid).get();
  if (callerSnap.data()?.role !== "admin") throw new HttpError(403, "Admin only.");

  const { tradeId, frozen } = body;
  if (typeof tradeId !== "string" || !tradeId) throw new HttpError(400, "Invalid trade id.");
  if (typeof frozen !== "boolean") throw new HttpError(400, "frozen must be true or false.");

  const tradeRef = db.collection("trades").doc(tradeId);
  const tradeSnap = await tradeRef.get();
  if (!tradeSnap.exists) throw new HttpError(404, "Trade not found.");
  if (tradeSnap.data().status !== "open") throw new HttpError(400, "Trade is already closed.");

  await tradeRef.update({
    frozen,
    frozenBy: frozen ? uid : FieldValue.delete(),
    frozenAt: frozen ? FieldValue.serverTimestamp() : FieldValue.delete(),
  });

  return { ok: true };
});
