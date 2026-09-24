import fs from "fs/promises";
import path from "path";
import os from "os";
import { Device } from "@/types";

// On Vercel, process.cwd() is read-only (/var/task), but os.tmpdir() (/tmp) is writable
const IS_VERCEL = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), "home-control-data")
  : path.join(process.cwd(), "data");

const DEVICES_FILE = path.join(DATA_DIR, "devices.json");

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

// In-memory fallback cache to ensure zero crash on read-only environments
let inMemoryDevices: Device[] | null = null;

async function ensureDataFileExists(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DEVICES_FILE);
    } catch {
      await fs.writeFile(
        DEVICES_FILE,
        JSON.stringify(INITIAL_DEVICES, null, 2),
        "utf-8"
      );
    }
  } catch (err) {
    // If read-only or permission error, handle gracefully
    console.warn("Notice: File system read-only or constrained. Using memory store.", err);
  }
}

export async function getDevices(): Promise<Device[]> {
  if (inMemoryDevices !== null) {
    return inMemoryDevices;
  }

  await ensureDataFileExists();
  try {
    const data = await fs.readFile(DEVICES_FILE, "utf-8");
    const parsed = JSON.parse(data) as Device[];
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

export async function saveDevices(devices: Device[]): Promise<void> {
  inMemoryDevices = devices;
  try {
    await ensureDataFileExists();
    await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8");
  } catch (err) {
    // Silently handle EROFS or read-only filesystem on Vercel lambda
    console.warn("Notice: Saved devices in memory (File system read-only on serverless).", err);
  }
}

export async function addDevice(
  newDeviceData: Omit<Device, "id" | "powerState" | "connectionState"> & {
    powerState?: Device["powerState"];
    connectionState?: Device["connectionState"];
  }
): Promise<Device> {
  const devices = await getDevices();
  
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
  await saveDevices(devices);
  return device;
}

export async function updateDevice(
  id: string,
  updates: Partial<Device>
): Promise<Device | null> {
  const devices = await getDevices();
  const index = devices.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const updated: Device = {
    ...devices[index],
    ...updates,
    lastSeen: new Date().toISOString(),
  };

  devices[index] = updated;
  await saveDevices(devices);
  return updated;
}

export async function deleteDevice(id: string): Promise<boolean> {
  const devices = await getDevices();
  const filtered = devices.filter((d) => d.id !== id);
  if (filtered.length === devices.length) return false;
  await saveDevices(filtered);
  return true;
}

export async function resetDevicesToDefault(): Promise<Device[]> {
  await saveDevices(INITIAL_DEVICES);
  return INITIAL_DEVICES;
}

export async function clearAllDevices(): Promise<Device[]> {
  await saveDevices([]);
  return [];
}
