const { admin } = require("./_lib/admin");
const { withHandler, requireUid } = require("./_lib/http");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_RATE = 0.01;

module.exports = withHandler(async (req) => {
  const uid = await requireUid(req);
  const supabase = admin;

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("locked, \"lastInterestAt\"")
    .eq("user_id", uid)
    .single();

  if (walletError || !wallet) return { ok: true };

  const locked = wallet.locked || 0;
  const lastInterestAt = wallet.lastInterestAt ? new Date(wallet.lastInterestAt).getTime() : null;
  const now = Date.now();

  if (!lastInterestAt) {
    await supabase
      .from("wallets")
      .update({ "lastInterestAt": new Date(now).toISOString() })
      .eq("user_id", uid);
    return { ok: true };
  }

  const daysElapsed = Math.floor((now - lastInterestAt) / ONE_DAY_MS);
  if (daysElapsed < 1) return { ok: true };

  const advancedAt = new Date(lastInterestAt + daysElapsed * ONE_DAY_MS).toISOString();
  if (locked <= 0) {
    await supabase
      .from("wallets")
      .update({ "lastInterestAt": advancedAt })
      .eq("user_id", uid);
    return { ok: true };
  }

  const interest = locked * (Math.pow(1 + DAILY_RATE, daysElapsed) - 1);
  
  await supabase
    .from("wallets")
    .update({
      locked: locked + interest,
      "lastInterestAt": advancedAt
    })
    .eq("user_id", uid);

  await supabase.from("transactions").insert({
    uid,
    type: "roi",
    amount: interest,
    note: "Daily interest on locked balance",
    "createdAt": new Date().toISOString()
  });

  return { ok: true };
});
