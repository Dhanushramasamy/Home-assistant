import { supabase } from "./supabaseClient";

// Server-only. Which switches each non-admin user may see and control.
// Admins always have every switch. Stored in `access` (user_id, switch_id);
// see supabase/four_tables.sql.

const ACCESS_TABLE = "access";
const USER_TABLE = "users";
export const ACCESS_SETUP_MESSAGE =
  "The access table isn't set up yet. Run supabase/four_tables.sql in Supabase, then save again.";

type Role = "admin" | "user";

async function userIdOf(username: string): Promise<string | null> {
  const { data } = await supabase.from(USER_TABLE).select("id").ilike("username", username.trim()).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Switch ids a user may use. Admins: "all". */
export async function allowedDeviceIds(username: string, role: Role): Promise<Set<string> | "all"> {
  if (role === "admin") return "all";
  const userId = await userIdOf(username);
  if (!userId) return new Set();
  const { data, error } = await supabase.from(ACCESS_TABLE).select("switch_id").eq("user_id", userId);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.switch_id as string));
}

export async function canUseDevice(username: string, role: Role, deviceId: string): Promise<boolean> {
  const allowed = await allowedDeviceIds(username, role);
  return allowed === "all" || allowed.has(deviceId);
}

/**
 * Replaces the full list of switches a user may use. New grants are added
 * before old ones are removed, so a failed save never wipes existing access.
 */
export async function setUserDevices(username: string, deviceIds: string[]): Promise<{ success: boolean; message: string }> {
  const userId = await userIdOf(username);
  if (!userId) return { success: false, message: `User '${username}' not found.` };
  const unique = Array.from(new Set(deviceIds));

  if (unique.length > 0) {
    const add = await supabase
      .from(ACCESS_TABLE)
      .upsert(unique.map((switch_id) => ({ user_id: userId, switch_id })), {
        onConflict: "user_id,switch_id",
        ignoreDuplicates: true,
      });
    if (add.error) return { success: false, message: missingTable(add.error) ? ACCESS_SETUP_MESSAGE : "Could not save access. Please try again." };
  }

  let remove = supabase.from(ACCESS_TABLE).delete().eq("user_id", userId);
  if (unique.length > 0) remove = remove.not("switch_id", "in", `(${unique.map((id) => `"${id}"`).join(",")})`);
  const del = await remove;
  if (del.error) return { success: false, message: missingTable(del.error) ? ACCESS_SETUP_MESSAGE : "Could not save access. Please try again." };
  return { success: true, message: "Saved." };
}

/** All users with their role and granted switches (for the admin Users screen). */
export async function listUsersWithAccess(): Promise<{ username: string; role: Role; deviceIds: string[] }[]> {
  const [{ data: users }, { data: grants }] = await Promise.all([
    supabase.from(USER_TABLE).select("id, username, role").order("created_at", { ascending: true }),
    supabase.from(ACCESS_TABLE).select("user_id, switch_id"),
  ]);
  const byUser = new Map<string, string[]>();
  for (const g of grants ?? []) {
    const list = byUser.get(g.user_id as string) ?? [];
    list.push(g.switch_id as string);
    byUser.set(g.user_id as string, list);
  }
  return ((users ?? []) as { id: string; username: string; role?: string }[]).map((u) => ({
    username: u.username,
    role: u.role === "admin" ? "admin" : "user",
    deviceIds: byUser.get(u.id) ?? [],
  }));
}

/** Where access is stored: the database, or nowhere yet (SQL not run). */
export async function accessStorageStatus(): Promise<"database" | "local" | "missing"> {
  const { error } = await supabase.from(ACCESS_TABLE).select("switch_id").limit(1);
  return error ? "missing" : "database";
}

function missingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message ?? "");
}
