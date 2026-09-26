import fs from "fs/promises";
import path from "path";
import os from "os";
import { supabase } from "./supabaseClient";

// Server-only. Which devices each non-admin user may see and control.
// Admins always have every device. Stored in user_device_access_PRB_home_assistant
// (supabase/add_device_access.sql). A local file is used only in development;
// in production (Vercel) the server's disk is temporary, so without the table
// saving fails with a clear message instead of silently losing the choice.

const ACCESS_TABLE = "user_device_access_PRB_home_assistant";
const USER_TABLE = "user_PRB_home_assistant";
const IS_VERCEL = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), "home-control-data") : path.join(process.cwd(), "data");
const ACCESS_FILE = path.join(DATA_DIR, "device-access.json");
const FILE_FALLBACK = !IS_VERCEL;
export const ACCESS_SETUP_MESSAGE =
  "Device access isn't set up in the database yet. Run supabase/add_device_access.sql in Supabase, then save again.";

let tableAvailable = true;
let retryAt = 0;

function tableUsable() {
  if (!tableAvailable && Date.now() >= retryAt) tableAvailable = true;
  return tableAvailable;
}
function markMissing(message: string) {
  tableAvailable = false;
  retryAt = Date.now() + 30_000;
  console.warn("Device access table not available, using local file:", message);
}

async function readFileAccess(): Promise<Record<string, string[]>> {
  try {
    return JSON.parse(await fs.readFile(ACCESS_FILE, "utf-8")) as Record<string, string[]>;
  } catch {
    return {};
  }
}
async function writeFileAccess(map: Record<string, string[]>) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(ACCESS_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local access file save notice:", err);
  }
}

const key = (username: string) => username.trim().toLowerCase();

/** Device ids a user may use. Admins: "all". */
export async function allowedDeviceIds(username: string, role: "admin" | "user"): Promise<Set<string> | "all"> {
  if (role === "admin") return "all";
  if (tableUsable()) {
    const { data, error } = await supabase.from(ACCESS_TABLE).select("device_id").eq("username", key(username));
    if (!error) return new Set((data ?? []).map((r) => r.device_id as string));
    markMissing(error.message);
  }
  // No table: development reads the local file; production grants nothing.
  return FILE_FALLBACK ? new Set((await readFileAccess())[key(username)] ?? []) : new Set();
}

export async function canUseDevice(username: string, role: "admin" | "user", deviceId: string): Promise<boolean> {
  const allowed = await allowedDeviceIds(username, role);
  return allowed === "all" || allowed.has(deviceId);
}

/**
 * Replaces the full list of devices a user may use. New grants are added
 * before old ones are removed, so a failed save never wipes existing access.
 */
export async function setUserDevices(username: string, deviceIds: string[]): Promise<{ success: boolean; message: string }> {
  const user = key(username);
  const unique = Array.from(new Set(deviceIds));

  if (tableUsable()) {
    if (unique.length > 0) {
      const add = await supabase
        .from(ACCESS_TABLE)
        .upsert(unique.map((device_id) => ({ username: user, device_id })), {
          onConflict: "username,device_id",
          ignoreDuplicates: true,
        });
      if (add.error) {
        if (add.error.code === "PGRST205" || add.error.message.includes("schema cache")) markMissing(add.error.message);
        else return { success: false, message: "Could not save access. Please try again." };
      }
    }
    if (tableUsable()) {
      let remove = supabase.from(ACCESS_TABLE).delete().eq("username", user);
      if (unique.length > 0) remove = remove.not("device_id", "in", `(${unique.map((id) => `"${id}"`).join(",")})`);
      const del = await remove;
      if (!del.error) return { success: true, message: "Saved." };
      if (del.error.code === "PGRST205" || del.error.message.includes("schema cache")) markMissing(del.error.message);
      else return { success: false, message: "Could not save access. Please try again." };
    }
  }

  if (!FILE_FALLBACK) return { success: false, message: ACCESS_SETUP_MESSAGE };
  const map = await readFileAccess();
  map[user] = unique;
  await writeFileAccess(map);
  return { success: true, message: "Saved (on this computer only; run supabase/add_device_access.sql to store it in the database)." };
}

/** All users with their role and granted devices (for the admin Users screen). */
export async function listUsersWithAccess(): Promise<{ username: string; role: "admin" | "user"; deviceIds: string[] }[]> {
  const { data: users } = await supabase.from(USER_TABLE).select("*").order("created_at", { ascending: true });
  const rows = (users ?? []) as { username: string; role?: string }[];

  let grants: Record<string, string[]> = {};
  if (tableUsable()) {
    const { data, error } = await supabase.from(ACCESS_TABLE).select("username, device_id");
    if (!error) {
      for (const g of data ?? []) (grants[g.username] ??= []).push(g.device_id);
    } else {
      markMissing(error.message);
      grants = FILE_FALLBACK ? await readFileAccess() : {};
    }
  } else {
    grants = FILE_FALLBACK ? await readFileAccess() : {};
  }

  return rows.map((u) => {
    const role: "admin" | "user" =
      u.role === "admin" || u.role === "user" ? u.role : u.username.toLowerCase() === "dhanushraja" ? "admin" : "user";
    return { username: u.username, role, deviceIds: grants[key(u.username)] ?? [] };
  });
}

/** Where access is stored: the database table, a local dev file, or nowhere yet. */
export async function accessStorageStatus(): Promise<"database" | "local" | "missing"> {
  const { error } = await supabase.from(ACCESS_TABLE).select("device_id").limit(1);
  if (!error) {
    tableAvailable = true;
    return "database";
  }
  return FILE_FALLBACK ? "local" : "missing";
}
