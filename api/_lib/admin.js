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

// Exporting a getter so callers always get the initialized instance
module.exports = {
  get admin() {
    if (!supabaseAdmin) throw new Error("Admin not initialized. Call ensureInitialized() first.");
    return supabaseAdmin;
  },
  ensureInitialized
};
