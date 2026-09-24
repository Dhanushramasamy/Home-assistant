import fs from "fs/promises";
import path from "path";
import { Device } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
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
    console.error("Error creating data directory or devices file:", err);
  }
}

export async function getDevices(): Promise<Device[]> {
  await ensureDataFileExists();
  try {
    const data = await fs.readFile(DEVICES_FILE, "utf-8");
    return JSON.parse(data) as Device[];
  } catch {
    return INITIAL_DEVICES;
  }
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const devices = await getDevices();
  return devices.find((d) => d.id === id) || null;
}

export async function saveDevices(devices: Device[]): Promise<void> {
  await ensureDataFileExists();
  await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8");
}

export async function addDevice(
  newDeviceData: Omit<Device, "id" | "powerState" | "connectionState"> & {
    powerState?: Device["powerState"];
    connectionState?: Device["connectionState"];
  }
): Promise<Device> {
  const devices = await getDevices();
  
  // Generate a clean slug/id
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
