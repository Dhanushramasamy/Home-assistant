import { createClient } from "@supabase/supabase-js";

// Server-only (used by lib/deviceStore and lib/userStore via API routes).
// Prefers the secret service-role key, which bypasses row-level security, so
// the tables can be locked to the public key (supabase/lock_down_tables.sql).
// Falls back to the publishable key until SUPABASE_SERVICE_ROLE_KEY is set.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcaxoxvkokwklazukpuu.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_xMA95EaTQ1mg6pWUbpYz-A_mR181iN_";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
