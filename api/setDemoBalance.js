const { admin } = require("./_lib/admin");
const { withHandler, requireUid, HttpError } = require("./_lib/http");

module.exports = withHandler(async (req, body) => {
  const uid = await requireUid(req);
  const supabase = admin;

  const { amount } = body;
  
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new HttpError(400, "Invalid amount.");
  }

  if (amount < 1 || amount > 500000) {
    throw new HttpError(400, "Demo balance must be between $1 and $500,000.");
  }

  const { error } = await supabase
    .from("wallets")
    .update({ demo_available: amount })
    .eq("user_id", uid);

  if (error) {
    throw new HttpError(500, "Failed to update demo balance.");
  }

  return { success: true, demo_available: amount };
});
