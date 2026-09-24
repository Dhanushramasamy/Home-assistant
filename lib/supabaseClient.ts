import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcaxoxvkokwklazukpuu.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_xMA95EaTQ1mg6pWUbpYz-A_mR181iN_";

export const supabase = createClient(supabaseUrl, supabaseKey);
