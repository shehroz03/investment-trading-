const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const db = admin.firestore();

  const callerSnap = await db.collection("users").doc(uid).get();
  if (callerSnap.data()?.role !== "admin") throw new HttpError(403, "Admin only.");

  const { targetUid, newPassword } = body;
  if (typeof targetUid !== "string" || !targetUid) throw new HttpError(400, "Invalid target user id.");
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters.");
  }

  try {
    await admin.auth().updateUser(targetUid, { password: newPassword });
  } catch (err) {
    if (err.code === "auth/user-not-found") throw new HttpError(404, "User not found.");
    throw new HttpError(500, err.message || "Failed to update password.");
  }

  return { ok: true };
});
