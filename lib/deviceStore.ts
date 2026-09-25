import fs from "fs/promises";
import path from "path";
import os from "os";
import { Device, DeviceTimerConfig } from "@/types";
import { supabase } from "./supabaseClient";

const IS_VERCEL = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), "home-control-data")
  : path.join(process.cwd(), "data");

const DEVICES_FILE = path.join(DATA_DIR, "devices.json");
const SUPABASE_DEVICE_TABLE = "device_PRB_home_assistant";
// One row per timer (supabase/add_device_timer_records.sql).
const SUPABASE_TIMER_TABLE = "device_timer_PRB_home_assistant";

export const INITIAL_DEVICES: Device[] = [
  {
    id: "bedroom-light",
    name: "Bedroom Light",
    room: "Bedroom",
    type: "light",
    mode: "direct",
    ip: "192.168.1.200",
    relay: 1,
    powerState: "off",
    connectionState: "connected",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "bedroom-fan",
    name: "Bedroom Fan",
    room: "Bedroom",
    type: "fan",
    mode: "direct",
    ip: "192.168.1.201",
    relay: 1,
    powerState: "on",
    connectionState: "connected",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "hall-light",
    name: "Hall Light",
    room: "Hall",
    type: "light",
    mode: "direct",
    ip: "192.168.1.202",
    relay: 1,
    powerState: "on",
    connectionState: "connected",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "kitchen-light",
    name: "Kitchen Light",
    room: "Kitchen",
    type: "light",
    mode: "direct",
    ip: "192.168.1.203",
    relay: 1,
    powerState: "off",
    connectionState: "connected",
    lastSeen: new Date().toISOString(),
  },
];

let inMemoryDevices: Device[] | null = null;

// Local file copy, used for timers saved while the timer table was missing.
let localDevicesCache: Device[] | null | undefined;
async function readLocalDevices(): Promise<Device[] | null> {
  if (localDevicesCache !== undefined) return localDevicesCache;
  try {
    localDevicesCache = JSON.parse(await fs.readFile(DEVICES_FILE, "utf-8")) as Device[];
  } catch {
    localDevicesCache = null;
  }
  return localDevicesCache;
}

export async function getDevices(username: string = "default_user"): Promise<Device[]> {
  try {
    // 1. Attempt Supabase query from device_PRB_home_assistant table
    const { data, error } = await supabase
      .from(SUPABASE_DEVICE_TABLE)
      .select("*");

    if (!error && data && data.length > 0) {
      const previous = inMemoryDevices ?? (await readLocalDevices());
      const formatted: Device[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        room: d.room,
        type: d.type || "light",
        mode: d.mode || "direct",
        ip: d.ip,
        relay: d.relay || 1,
        powerState: d.power_state || "off",
        connectionState: d.connection_state || "connected",
        lastSeen: d.updated_at || new Date().toISOString(),
        timers: previous?.find((m) => m.id === d.id)?.timers ?? [],
      }));
      await attachScheduledTimers(formatted);
      inMemoryDevices = formatted;
      return formatted;
    }
  } catch (err) {
    console.warn("Supabase fetch notice:", err);
  }

  if (inMemoryDevices !== null) {
    return inMemoryDevices;
  }

  // Local file fallback
  try {
    const fileData = await fs.readFile(DEVICES_FILE, "utf-8");
    const parsed = JSON.parse(fileData) as Device[];
    inMemoryDevices = parsed;
    return parsed;
  } catch {
    inMemoryDevices = INITIAL_DEVICES;
    return INITIAL_DEVICES;
  }
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const devices = await getDevices();
  return devices.find((d) => d.id === id) || null;
}

export async function saveDevices(devices: Device[], username: string = "default_user"): Promise<void> {
  inMemoryDevices = devices;

  try {
    // Sync to Supabase device_PRB_home_assistant table
    const upsertRows = devices.map((d) => ({
      id: d.id,
      username,
      name: d.name,
      room: d.room,
      type: d.type,
      mode: d.mode,
      ip: d.ip,
      relay: d.relay,
      power_state: d.powerState,
      connection_state: d.connectionState,
      updated_at: new Date().toISOString(),
    }));

    await supabase.from(SUPABASE_DEVICE_TABLE).upsert(upsertRows, { onConflict: "id" });
  } catch (err) {
    console.warn("Supabase sync notice:", err);
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local file save notice:", err);
  }
}

export async function addDevice(
  newDeviceData: Omit<Device, "id" | "powerState" | "connectionState"> & {
    powerState?: Device["powerState"];
    connectionState?: Device["connectionState"];
  },
  username: string = "default_user"
): Promise<Device> {
  const devices = await getDevices(username);
  
  const baseId = newDeviceData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  let uniqueId = baseId || `device-${Date.now()}`;
  let count = 1;
  while (devices.some((d) => d.id === uniqueId)) {
    uniqueId = `${baseId}-${count++}`;
  }

  const device: Device = {
    ...newDeviceData,
    id: uniqueId,
    powerState: newDeviceData.powerState || "off",
    connectionState: newDeviceData.connectionState || "connected",
    lastSeen: new Date().toISOString(),
  };

  devices.push(device);
  await saveDevices(devices, username);
  return device;
}

export async function updateDevice(
  id: string,
  updates: Partial<Device>,
  username: string = "default_user"
): Promise<Device | null> {
  const devices = await getDevices(username);
  const index = devices.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const updated: Device = {
    ...devices[index],
    ...updates,
    lastSeen: new Date().toISOString(),
  };

  devices[index] = updated;
  await saveDevices(devices, username);
  return updated;
}

export async function deleteDevice(id: string, username: string = "default_user"): Promise<boolean> {
  const devices = await getDevices(username);
  const filtered = devices.filter((d) => d.id !== id);
  if (filtered.length === devices.length) return false;

  try {
    await supabase.from(SUPABASE_DEVICE_TABLE).delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase delete notice:", err);
  }

  await saveDevices(filtered, username);
  return true;
}

export async function resetDevicesToDefault(): Promise<Device[]> {
  await saveDevices(INITIAL_DEVICES);
  return INITIAL_DEVICES;
}

export async function clearAllDevices(username: string = "default_user"): Promise<Device[]> {
  try {
    await supabase.from(SUPABASE_DEVICE_TABLE).delete().neq("id", "none");
  } catch {}
  await saveDevices([], username);
  return [];
}

/* ------------------------------------------------------------------ */
/* Timer records                                                       */
/* ------------------------------------------------------------------ */
// The DB remembers what the user scheduled (and the ESP32's id for it).
// It is never proof that a timer is running; ESP32 /status decides that.
// If the timer table doesn't exist yet, records live in memory / the local file.

// If the timer table is missing (SQL not run yet), fall back to local records
// and check again after a short while instead of giving up for good.
let timerTableAvailable = true;
let timerTableRetryAt = 0;
const TIMER_TABLE_RETRY_MS = 30_000;

function timerTableUsable(): boolean {
  if (!timerTableAvailable && Date.now() >= timerTableRetryAt) timerTableAvailable = true;
  return timerTableAvailable;
}

function markTimerTableMissing(message: string) {
  timerTableAvailable = false;
  timerTableRetryAt = Date.now() + TIMER_TABLE_RETRY_MS;
  console.warn("Timer table not available, using local timer records:", message);
}

function rowToTimerRecord(r: Record<string, unknown>): DeviceTimerConfig | null {
  if (r.action !== "on" && r.action !== "off") return null;
  if (typeof r.seconds !== "number") return null;
  return {
    recordId: typeof r.id === "string" ? r.id : undefined,
    espId: typeof r.esp_timer_id === "number" ? r.esp_timer_id : undefined,
    action: r.action,
    seconds: r.seconds,
    repeat: r.repeat === true,
    startedAt: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
  };
}

/**
 * Loads every device's still-scheduled timer records onto the device objects.
 * Timers that were only saved locally (table missing at the time) are copied
 * into the table first, so every browser and server sees the same records.
 */
async function attachScheduledTimers(devices: Device[]): Promise<void> {
  if (!timerTableUsable()) return;
  let migrated = false;
  try {
    const localOnly = devices.flatMap((d) =>
      (d.timers ?? []).filter((t) => !t.recordId).map((t) => ({ deviceId: d.id, t }))
    );
    if (localOnly.length > 0) {
      const { error: insertError } = await supabase.from(SUPABASE_TIMER_TABLE).insert(
        localOnly.map(({ deviceId, t }) => ({
          device_id: deviceId,
          esp_timer_id: t.espId ?? null,
          action: t.action,
          seconds: t.seconds,
          repeat: t.repeat,
          status: "scheduled",
          created_at: t.startedAt,
        }))
      );
      if (insertError) {
        markTimerTableMissing(insertError.message);
        return;
      }
      migrated = true;
    }

    const { data, error } = await supabase
      .from(SUPABASE_TIMER_TABLE)
      .select("*")
      .eq("status", "scheduled")
      .order("created_at", { ascending: true });
    if (error) {
      markTimerTableMissing(error.message);
      return;
    }
    const byDevice = new Map<string, DeviceTimerConfig[]>();
    for (const row of data ?? []) {
      const rec = rowToTimerRecord(row);
      if (!rec) continue;
      const list = byDevice.get(row.device_id) ?? [];
      list.push(rec);
      byDevice.set(row.device_id, list);
    }
    for (const d of devices) d.timers = byDevice.get(d.id) ?? [];
    // Rewrite the local copy so migrated timers aren't inserted again later.
    if (migrated) {
      localDevicesCache = devices;
      await persistLocal(devices);
    }
  } catch (err) {
    console.warn("Timer records fetch notice:", err);
  }
}

async function persistLocal(devices: Device[]) {
  localDevicesCache = devices;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local file save notice:", err);
  }
}

/** Records a timer the ESP32 accepted (espId = the id the ESP32 returned). */
export async function addTimerRecord(deviceId: string, timer: Omit<DeviceTimerConfig, "recordId">): Promise<void> {
  const devices = await getDevices();
  const device = devices.find((d) => d.id === deviceId);
  if (!device) return;

  let recordId: string | undefined;
  if (timerTableUsable()) {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TIMER_TABLE)
        .insert({
          device_id: deviceId,
          esp_timer_id: timer.espId ?? null,
          action: timer.action,
          seconds: timer.seconds,
          repeat: timer.repeat,
          status: "scheduled",
        })
        .select("id")
        .single();
      if (error) markTimerTableMissing(error.message);
      recordId = data?.id;
    } catch (err) {
      console.warn("Timer record insert notice:", err);
    }
  }

  device.timers = [...(device.timers ?? []), { ...timer, recordId }];
  inMemoryDevices = devices;
  await persistLocal(devices);
}

/**
 * Marks timer records as finished. `espIds` = the ESP32 ids to close, or "all".
 * status: "cancelled" (from the app) or "ended" (ESP32 no longer reports it).
 */
export async function closeTimerRecords(
  deviceId: string,
  espIds: number[] | "all",
  status: "cancelled" | "ended"
): Promise<void> {
  const devices = await getDevices();
  const device = devices.find((d) => d.id === deviceId);
  if (!device) return;

  const current = device.timers ?? [];
  const closing = espIds === "all" ? current : current.filter((t) => t.espId !== undefined && espIds.includes(t.espId));
  if (closing.length === 0) return;

  if (timerTableUsable()) {
    const recordIds = closing.map((t) => t.recordId).filter((id): id is string => !!id);
    if (recordIds.length > 0) {
      try {
        const { error } = await supabase
          .from(SUPABASE_TIMER_TABLE)
          .update({ status, updated_at: new Date().toISOString() })
          .in("id", recordIds);
        if (error) console.warn("Timer record update notice:", error.message);
      } catch (err) {
        console.warn("Timer record update notice:", err);
      }
    }
  }

  device.timers = current.filter((t) => !closing.includes(t));
  inMemoryDevices = devices;
  await persistLocal(devices);
}

/**
 * Brings the DB in line with what the ESP32 reports:
 * - scheduled records whose timer is no longer running are marked "ended";
 * - running timers the DB doesn't know (created from another browser whose
 *   save failed, or directly on the device) are added, so every client sees them.
 * Timers are never re-created on the ESP32 from the DB.
 */
export async function reconcileTimerRecords(
  deviceId: string,
  running: { id: number; action: "on" | "off"; seconds: number; repeat: boolean; remaining: number }[]
): Promise<void> {
  const devices = await getDevices();
  const target = devices.find((d) => d.id === deviceId);
  if (!target) return;

  const runningIds = running.map((t) => t.id);
  const current = target.timers ?? [];
  const closing = current.filter((t) => t.espId === undefined || !runningIds.includes(t.espId));
  const knownIds = new Set(current.map((t) => t.espId));
  const unknown = running.filter((t) => !knownIds.has(t.id));
  if (closing.length === 0 && unknown.length === 0) return;

  const adopted: DeviceTimerConfig[] = unknown.map((t) => ({
    espId: t.id,
    action: t.action,
    seconds: t.seconds,
    repeat: t.repeat,
    // Best estimate of when it started, from what's left on the device.
    startedAt: new Date(Date.now() - Math.max(0, t.seconds - t.remaining) * 1000).toISOString(),
  }));

  if (timerTableUsable()) {
    const recordIds = closing.map((t) => t.recordId).filter((id): id is string => !!id);
    try {
      if (recordIds.length > 0) {
        await supabase
          .from(SUPABASE_TIMER_TABLE)
          .update({ status: "ended", updated_at: new Date().toISOString() })
          .in("id", recordIds);
      }
      if (adopted.length > 0) {
        const { data, error } = await supabase
          .from(SUPABASE_TIMER_TABLE)
          .insert(
            adopted.map((t) => ({
              device_id: deviceId,
              esp_timer_id: t.espId,
              action: t.action,
              seconds: t.seconds,
              repeat: t.repeat,
              status: "scheduled",
              created_at: t.startedAt,
            }))
          )
          .select("id, esp_timer_id");
        if (error) markTimerTableMissing(error.message);
        for (const row of data ?? []) {
          const match = adopted.find((t) => t.espId === row.esp_timer_id);
          if (match) match.recordId = row.id;
        }
      }
    } catch (err) {
      console.warn("Timer record reconcile notice:", err);
    }
  }

  target.timers = [...current.filter((t) => !closing.includes(t)), ...adopted];
  inMemoryDevices = devices;
  await persistLocal(devices);
}
