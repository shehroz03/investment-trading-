const admin = require("firebase-admin");

let initialized = false;

// Lazy, on-demand init — never runs at module-load time, so a missing/bad
// service account key throws only once we're inside withHandler's try/catch
// (after CORS headers are already set), instead of crashing the whole
// function before it can respond to the browser's CORS preflight.
function ensureInitialized() {
  if (initialized) return;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error("Server misconfigured: FIREBASE_SERVICE_ACCOUNT_KEY is not set.");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(key);
  } catch {
    throw new Error("Server misconfigured: FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
}

module.exports = { admin, ensureInitialized };
