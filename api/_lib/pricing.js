const { HttpError } = require("./http");

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
  // api.binance.com blocks requests from most cloud/serverless IP ranges (Vercel runs on
  // AWS). data-api.binance.vision is Binance's own public read-only market-data mirror,
  // meant for exactly this kind of server-side lookup, and isn't subject to the same block.
  const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`);
  if (!res.ok) throw new HttpError(503, "Could not fetch market price. Try again.");
  const data = await res.json();
  const price = parseFloat(data.price);
  if (!price || Number.isNaN(price)) throw new HttpError(503, "Invalid market price received.");
  return price;
}

module.exports = { ALLOWED_DURATIONS, SIMULATED_RANGES, isValidSymbol, fetchPrice };
