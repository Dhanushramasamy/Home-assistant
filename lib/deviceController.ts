import { getDeviceById, updateDevice, saveDeviceTimer } from "./deviceStore";
import { getNetworkConfig } from "./networkStore";
import {
  Device,
  DeviceControlResponse,
  DeviceStatusResponse,
  DeviceTimerResponse,
  DeviceTimerStatus,
  NetworkConfig,
  TestConnectionResponse,
  TimerAction,
  PowerState,
  ConnectionState,
} from "@/types";

/**
 * Controller abstraction layer for smart home devices.
 * Decides whether to use Direct ESP32 mode or Raspberry Pi 5 Gateway mode securely.
 */

export async function executeDeviceControl(
  deviceId: string,
  action: "on" | "off" | "toggle"
): Promise<DeviceControlResponse> {
  const device = await getDeviceById(deviceId);
  const networkConfig = await getNetworkConfig();

  if (!device) {
    throw new Error(`Device with ID "${deviceId}" was not found.`);
  }

  // Determine target state if toggle
  let nextPowerState: PowerState = action === "toggle"
    ? device.powerState === "on" ? "off" : "on"
    : action;

  // Determine active communication mode
  const effectiveMode =
    networkConfig.mode === "gateway" || device.mode === "gateway"
      ? "gateway"
      : "direct";

  const timestamp = new Date().toISOString();

  if (effectiveMode === "direct") {
    // MODE 1: DIRECT ESP32
    // URL: http://<ESP32_IP>/on or http://<ESP32_IP>/off
    const targetUrl = `http://${device.ip}/${nextPowerState}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      networkConfig.timeoutMs || 3000
    );

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "text/plain, application/json, */*" },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        await updateDevice(device.id, {
          powerState: nextPowerState,
          connectionState: "connected",
        });

        return {
          success: true,
          deviceId: device.id,
          powerState: nextPowerState,
          connectionState: "connected",
          modeUsed: "direct",
          targetUrl,
          message: `${device.name} turned ${nextPowerState.toUpperCase()} via Direct ESP32 (${device.ip}).`,
          timestamp,
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const errorDetail = isAbort ? "Connection timed out" : (err as Error)?.message || "Network unreachable";

      // Fallback update to keep local prototype responsive even without physical ESP32 connected
      const updated = await updateDevice(device.id, {
        powerState: nextPowerState,
        connectionState: "offline",
      });

      return {
        success: true,
        deviceId: device.id,
        powerState: updated?.powerState || nextPowerState,
        connectionState: "offline",
        modeUsed: "direct",
        targetUrl,
        message: `${device.name} state updated to ${nextPowerState.toUpperCase()} (Target: ${targetUrl} [${errorDetail}]).`,
        timestamp,
        simulated: true,
      };
    }
  } else {
    // MODE 2: RASPBERRY PI 5 GATEWAY
    // Sends request to Pi 5 Gateway endpoint
    const gatewayHost = networkConfig.gatewayIp || "192.168.1.100";
    const gatewayPort = networkConfig.gatewayPort || 5000;
    const gatewayEndpoint = `http://${gatewayHost}:${gatewayPort}/api/gateway/device`;
    const targetUrl = `${gatewayEndpoint} -> ESP32 (${device.ip}/${nextPowerState})`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      networkConfig.timeoutMs || 3000
    );

    try {
      const response = await fetch(gatewayEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.id,
          action: nextPowerState,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        await updateDevice(device.id, {
          powerState: nextPowerState,
          connectionState: "connected",
        });

        return {
          success: true,
          deviceId: device.id,
          powerState: nextPowerState,
          connectionState: "connected",
          modeUsed: "gateway",
          targetUrl,
          message: `${device.name} turned ${nextPowerState.toUpperCase()} via Raspberry Pi 5 Gateway (${gatewayHost}:${gatewayPort}).`,
          timestamp,
        };
      } else {
        throw new Error(`Gateway returned status ${response.status}`);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const errorDetail = isAbort ? "Gateway connection timed out" : (err as Error)?.message || "Gateway unreachable";

      // Fallback state update for simulator / offline prototype
      await updateDevice(device.id, {
        powerState: nextPowerState,
        connectionState: "offline",
      });

      return {
        success: true,
        deviceId: device.id,
        powerState: nextPowerState,
        connectionState: "offline",
        modeUsed: "gateway",
        targetUrl,
        message: `${device.name} state updated to ${nextPowerState.toUpperCase()} via Gateway Routing (${gatewayHost}:${gatewayPort} [${errorDetail}]).`,
        timestamp,
        simulated: true,
      };
    }
  }
}

/**
 * Tests reachability of a single device
 */
export async function testDeviceReachability(
  deviceId: string
): Promise<TestConnectionResponse> {
  const device = await getDeviceById(deviceId);
  const networkConfig = await getNetworkConfig();

  if (!device) {
    return {
      success: false,
      deviceId,
      deviceName: "Unknown",
      ip: "0.0.0.0",
      mode: "direct",
      reachable: false,
      message: `Device with ID "${deviceId}" not found.`,
      targetUrl: "N/A",
    };
  }

  const effectiveMode =
    networkConfig.mode === "gateway" || device.mode === "gateway"
      ? "gateway"
      : "direct";

  const startTime = Date.now();

  if (effectiveMode === "direct") {
    const targetUrl = `http://${device.ip}/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      networkConfig.timeoutMs || 2500
    );

    try {
      const response = await fetch(targetUrl, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      await updateDevice(device.id, { connectionState: "connected" });

      return {
        success: true,
        deviceId: device.id,
        deviceName: device.name,
        ip: device.ip,
        mode: "direct",
        reachable: true,
        responseTimeMs,
        message: `✓ ${device.name} (${device.ip}) is reachable directly!`,
        targetUrl,
      };
    } catch {
      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      // Report clearly without failing the application
      return {
        success: true,
        deviceId: device.id,
        deviceName: device.name,
        ip: device.ip,
        mode: "direct",
        reachable: false,
        responseTimeMs,
        message: `✕ ${device.name} (${device.ip}) is not reachable directly over HTTP.`,
        targetUrl,
        details: "Ensure the ESP32 is powered on and connected to local WiFi.",
        simulated: true,
      };
    }
  } else {
    // Gateway mode test
    const gatewayHost = networkConfig.gatewayIp || "192.168.1.100";
    const gatewayPort = networkConfig.gatewayPort || 5000;
    const targetUrl = `http://${gatewayHost}:${gatewayPort}/api/gateway/device`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      networkConfig.timeoutMs || 2500
    );

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.id, action: "status" }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      return {
        success: true,
        deviceId: device.id,
        deviceName: device.name,
        ip: device.ip,
        mode: "gateway",
        reachable: response.ok,
        responseTimeMs,
        message: response.ok
          ? `✓ ${device.name} reached via Raspberry Pi 5 Gateway!`
          : `✕ Raspberry Pi 5 Gateway responded with error ${response.status}`,
        targetUrl,
      };
    } catch {
      clearTimeout(timeoutId);
      return {
        success: true,
        deviceId: device.id,
        deviceName: device.name,
        ip: device.ip,
        mode: "gateway",
        reachable: false,
        message: `✕ Raspberry Pi 5 Gateway (${gatewayHost}:${gatewayPort}) is not reachable.`,
        targetUrl,
        simulated: true,
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* ESP32 timer + status                                                */
/* ------------------------------------------------------------------ */

/** ESP32 paths the app is allowed to call for timers/status. */
export type EspTimerPath = "status" | "timer" | "timer/cancel";

interface EspResult {
  ok: boolean;
  json: Record<string, unknown> | null;
  targetUrl: string;
  error?: string;
}

/**
 * Sends a GET to an ESP32 endpoint, directly or through the Pi gateway,
 * using the same mode rules as ON/OFF.
 */
async function espRequest(
  device: Device,
  networkConfig: NetworkConfig,
  path: EspTimerPath,
  query: Record<string, string> = {}
): Promise<EspResult> {
  const qs = new URLSearchParams(query).toString();
  const espPath = qs ? `${path}?${qs}` : path;
  const effectiveMode =
    networkConfig.mode === "gateway" || device.mode === "gateway" ? "gateway" : "direct";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), networkConfig.timeoutMs || 3000);

  try {
    if (effectiveMode === "direct") {
      const targetUrl = `http://${device.ip}/${espPath}`;
      const response = await fetch(targetUrl, { method: "GET", signal: controller.signal, cache: "no-store" });
      const json = await response.json().catch(() => null);
      return { ok: response.ok && json?.ok !== false, json, targetUrl };
    }

    const gatewayHost = networkConfig.gatewayIp || "192.168.1.100";
    const gatewayPort = networkConfig.gatewayPort || 5000;
    const gatewayEndpoint = `http://${gatewayHost}:${gatewayPort}/api/gateway/device`;
    const targetUrl = `${gatewayEndpoint} -> ESP32 (${device.ip}/${espPath})`;
    const response = await fetch(gatewayEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id, action: "esp", path, query }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    const json = (body?.esp as Record<string, unknown> | undefined) ?? null;
    return { ok: response.ok && !!json && json.ok !== false, json, targetUrl };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      json: null,
      targetUrl: `http://${device.ip}/${espPath}`,
      error: isAbort ? "Connection timed out" : (err as Error)?.message || "Network unreachable",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseTimer(raw: unknown): DeviceTimerStatus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  return {
    active: t.active === true,
    action: t.action === "on" || t.action === "off" ? t.action : undefined,
    repeat: typeof t.repeat === "boolean" ? t.repeat : undefined,
    seconds: typeof t.seconds === "number" ? t.seconds : undefined,
    remaining: typeof t.remaining === "number" ? t.remaining : undefined,
  };
}

/** Reads `/status` from the ESP32. Its answer is the truth for power + timer. */
export async function getDeviceStatus(deviceId: string): Promise<DeviceStatusResponse> {
  const device = await getDeviceById(deviceId);
  const fetchedAt = new Date().toISOString();
  if (!device) {
    return { success: false, deviceId, reachable: false, fetchedAt, message: "Device not found." };
  }

  const networkConfig = await getNetworkConfig();
  const res = await espRequest(device, networkConfig, "status");
  if (!res.ok || !res.json) {
    return { success: true, deviceId, reachable: false, fetchedAt, message: res.error || "ESP32 did not return status." };
  }

  const power = res.json.power === "on" || res.json.power === "off" ? (res.json.power as PowerState) : undefined;
  if ((power && power !== device.powerState) || device.connectionState !== "connected") {
    await updateDevice(device.id, { ...(power ? { powerState: power } : {}), connectionState: "connected" });
  }

  return {
    success: true,
    deviceId,
    reachable: true,
    power,
    timer: parseTimer(res.json.timer) ?? { active: false },
    espDevice: typeof res.json.device === "string" ? res.json.device : undefined,
    uptime: typeof res.json.uptime === "number" ? res.json.uptime : undefined,
    rssi: typeof res.json.rssi === "number" ? res.json.rssi : undefined,
    fetchedAt,
  };
}

/** Saves the requested timer, then asks the ESP32 to run it. */
export async function startDeviceTimer(
  deviceId: string,
  action: TimerAction,
  seconds: number,
  repeat: boolean
): Promise<DeviceTimerResponse> {
  const device = await getDeviceById(deviceId);
  if (!device) {
    return { success: false, deviceId, reachable: false, targetUrl: "N/A", message: "Device not found." };
  }

  await saveDeviceTimer(device.id, { action, seconds, repeat, startedAt: new Date().toISOString() });

  const networkConfig = await getNetworkConfig();
  const query: Record<string, string> = { action, seconds: String(seconds) };
  if (repeat) query.repeat = "true";
  const res = await espRequest(device, networkConfig, "timer", query);

  return {
    success: true,
    deviceId,
    reachable: res.ok,
    timer: res.ok ? parseTimer(res.json?.timer) ?? { active: true, action, repeat, seconds, remaining: seconds } : undefined,
    targetUrl: res.targetUrl,
    message: res.ok
      ? `Timer set on ${device.name}: ${action.toUpperCase()} ${repeat ? "every" : "after"} ${seconds}s.`
      : `Timer saved, but ${device.name} could not be reached (${res.error || "no response"}).`,
  };
}

/** Clears the saved timer and asks the ESP32 to cancel it. */
export async function cancelDeviceTimer(deviceId: string): Promise<DeviceTimerResponse> {
  const device = await getDeviceById(deviceId);
  if (!device) {
    return { success: false, deviceId, reachable: false, targetUrl: "N/A", message: "Device not found." };
  }

  await saveDeviceTimer(device.id, null);

  const networkConfig = await getNetworkConfig();
  const res = await espRequest(device, networkConfig, "timer/cancel");

  return {
    success: true,
    deviceId,
    reachable: res.ok,
    timer: res.ok ? { active: false } : undefined,
    targetUrl: res.targetUrl,
    message: res.ok
      ? `Timer cancelled on ${device.name}.`
      : `Timer cleared in the app, but ${device.name} could not be reached (${res.error || "no response"}).`,
  };
}
