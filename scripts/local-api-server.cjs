// Runs the api/*.js Vercel serverless functions locally, using this machine's own .env
// file (via `node --env-file=.env`), so `npm run dev` works end-to-end without depending
// on any deployed Vercel project or its (possibly out-of-sync) environment variables.
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = Number(process.env.LOCAL_API_PORT) || 3001;
const apiDir = path.join(__dirname, "..", "api");

const routes = new Map();
for (const file of fs.readdirSync(apiDir)) {
  if (!file.endsWith(".js")) continue;
  const routeName = file.slice(0, -3);
  routes.set(`/api/${routeName}`, require(path.join(apiDir, file)));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Mimic the subset of the Vercel Node response API these handlers rely on.
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
    return res;
  };

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const handler = routes.get(pathname);

  if (!handler) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  try {
    const raw = await readBody(req);
    req.body = raw ? JSON.parse(raw) : {};
  } catch {
    req.body = {};
  }

  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[local-api] ${pathname} crashed:`, err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error." });
  }
});

server.listen(PORT, () => {
  console.log(`[local-api] Serving ${routes.size} route(s) from api/ on http://localhost:${PORT}`);
});
