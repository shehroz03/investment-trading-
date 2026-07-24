const admin = require("./admin");

// Bearer-token auth (not cookie-based), so an open CORS policy here doesn't
// grant anything a valid Firebase ID token wouldn't already allow.
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function requireUid(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new HttpError(401, "Sign in required.");
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new HttpError(401, "Sign in required.");
  }
}

// Wraps a POST-only handler with CORS, preflight, and uniform error responses.
function withHandler(handler) {
  return async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed." });
      return;
    }
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const result = await handler(req, body);
      res.status(200).json(result);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      res.status(status).json({ error: err.message || "Internal error." });
    }
  };
}

module.exports = { setCors, HttpError, requireUid, withHandler };
