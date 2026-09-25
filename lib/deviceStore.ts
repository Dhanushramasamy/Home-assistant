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

// Timer config columns (added by supabase/add_device_timer.sql). If they are
// missing, the timer config is kept in memory / the local JSON file only.
function rowToTimer(d: Record<string, unknown>): DeviceTimerConfig | null {
  if (d.timer_action !== "on" && d.timer_action !== "off") return null;
  if (typeof d.timer_seconds !== "number") return null;
  return {
    action: d.timer_action,
    seconds: d.timer_seconds,
    repeat: d.timer_repeat === true,
    startedAt: typeof d.timer_started_at === "string" ? d.timer_started_at : new Date().toISOString(),
  };
}

export async function getDevices(username: string = "default_user"): Promise<Device[]> {
  try {
    // 1. Attempt Supabase query from device_PRB_home_assistant table
    const { data, error } = await supabase
      .from(SUPABASE_DEVICE_TABLE)
      .select("*");

    if (!error && data && data.length > 0) {
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
        timer: rowToTimer(d) ?? inMemoryDevices?.find((m) => m.id === d.id)?.timer ?? null,
      }));
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

/**
 * Saves (or clears, with null) the timer the user configured for a device.
 * The existing device upsert is left untouched; the timer columns are written
 * in a separate update so a missing column can never break device sync.
 */
export async function saveDeviceTimer(id: string, timer: DeviceTimerConfig | null): Promise<void> {
  const devices = await getDevices();
  const index = devices.findIndex((d) => d.id === id);
  if (index === -1) return;
  devices[index] = { ...devices[index], timer };
  inMemoryDevices = devices;

  try {
    const { error } = await supabase
      .from(SUPABASE_DEVICE_TABLE)
      .update({
        timer_action: timer?.action ?? null,
        timer_seconds: timer?.seconds ?? null,
        timer_repeat: timer?.repeat ?? null,
        timer_started_at: timer?.startedAt ?? null,
      })
      .eq("id", id);
    if (error) console.warn("Supabase timer save notice:", error.message);
  } catch (err) {
    console.warn("Supabase timer save notice:", err);
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local file save notice:", err);
  }
}
