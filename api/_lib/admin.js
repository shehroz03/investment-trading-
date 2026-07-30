const { createClient } = require("@supabase/supabase-js");

let supabaseAdmin = null;

function ensureInitialized() {
  if (supabaseAdmin) return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  
  supabaseAdmin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Exporting a getter so callers always get the initialized instance. Every api/*.js file
// destructures `admin` at the top of the module (e.g. `const { admin } = require(...)`),
// which reads this getter at require-time — before any request has run withHandler's
// ensureInitialized() call. Self-initializing here (rather than throwing) means that
// works correctly regardless of whether `admin` is accessed at module load or later
// inside a handler.
module.exports = {
  get admin() {
    if (!supabaseAdmin) ensureInitialized();
    return supabaseAdmin;
  },
  ensureInitialized
};
