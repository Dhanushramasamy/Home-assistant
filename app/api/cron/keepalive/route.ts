import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Called once a day by Vercel Cron (vercel.json) so the free Supabase project
 * always has activity and never pauses. Vercel sends `Authorization: Bearer
 * <CRON_SECRET>`; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const { count, error } = await supabase
    .from("switches")
    .select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, switches: count, at: new Date().toISOString() });
}
