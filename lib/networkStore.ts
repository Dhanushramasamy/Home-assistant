import fs from "fs/promises";
import path from "path";
import os from "os";
import { NetworkConfig } from "@/types";

const IS_VERCEL = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), "home-control-data")
  : path.join(process.cwd(), "data");

const NETWORK_FILE = path.join(DATA_DIR, "network.json");

export const INITIAL_NETWORK_CONFIG: NetworkConfig = {
  name: "Home WiFi",
  subnet: "192.168.1.0/24",
  gateway: "192.168.1.1",
  mode: "direct",
  gatewayIp: "192.168.1.100",
  gatewayPort: 5000,
  timeoutMs: 4000,
};

let inMemoryNetworkConfig: NetworkConfig | null = null;

async function ensureDataFileExists(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(NETWORK_FILE);
    } catch {
      await fs.writeFile(
        NETWORK_FILE,
        JSON.stringify(INITIAL_NETWORK_CONFIG, null, 2),
        "utf-8"
      );
    }
  } catch (err) {
    console.warn("Notice: Network config using memory store.", err);
  }
}

export async function getNetworkConfig(): Promise<NetworkConfig> {
  if (inMemoryNetworkConfig !== null) {
    return inMemoryNetworkConfig;
  }

  await ensureDataFileExists();
  try {
    const data = await fs.readFile(NETWORK_FILE, "utf-8");
    const parsed = { ...INITIAL_NETWORK_CONFIG, ...JSON.parse(data) };
    inMemoryNetworkConfig = parsed;
    return parsed;
  } catch {
    inMemoryNetworkConfig = INITIAL_NETWORK_CONFIG;
    return INITIAL_NETWORK_CONFIG;
  }
}

export async function saveNetworkConfig(
  config: Partial<NetworkConfig>
): Promise<NetworkConfig> {
  const current = await getNetworkConfig();
  const updated: NetworkConfig = { ...current, ...config };
  inMemoryNetworkConfig = updated;

  try {
    await ensureDataFileExists();
    await fs.writeFile(NETWORK_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: Saved network config in memory (File system read-only).", err);
  }

  return updated;
}

export async function resetNetworkConfigToDefault(): Promise<NetworkConfig> {
  await saveNetworkConfig(INITIAL_NETWORK_CONFIG);
  return INITIAL_NETWORK_CONFIG;
}
