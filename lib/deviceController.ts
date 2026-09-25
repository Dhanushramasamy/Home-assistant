import { getDeviceById, updateDevice, addTimerRecord, closeTimerRecords, reconcileTimerRecords } from "./deviceStore";
import { parseTimerEntry, parseTimers, reasonFromStatus, timerErrorMessage } from "./timerParse";
import { getNetworkConfig } from "./networkStore";
import {
  Device,
  DeviceControlResponse,
  DeviceStatusResponse,
  DeviceTimerResponse,
  DeviceTimerEntry,
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
/* ESP32 timers + status                                               */
/* ------------------------------------------------------------------ */

/** ESP32 paths the app is allowed to call for timers/status. */
export type EspTimerPath = "status" | "timers" | "timer" | "timer/cancel" | "timer/clear";

interface EspResult {
  /** The ESP32 answered with HTTP (even if it rejected the request). */
  reached: boolean;
  /** HTTP 2xx and the body did not say ok:false. */
  ok: boolean;
  /** HTTP status from the ESP32 (0 if it wasn't reached). */
  status: number;
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
      return { reached: true, ok: response.ok && json?.ok !== false, status: response.status, json, targetUrl };
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
    return { reached: !!json, ok: response.ok && !!json && json.ok !== false, status: json ? response.status : 0, json, targetUrl };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      reached: false,
      ok: false,
      status: 0,
      json: null,
      targetUrl: `http://${device.ip}/${espPath}`,
      error: isAbort ? "Connection timed out" : (err as Error)?.message || "Network unreachable",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Reads `/status` from the ESP32 (falls back to `/timers` if status has no
 * timer list). The ESP32 is the truth for power and running timers; the DB is
 * reconciled to it. Offline devices keep their saved records, reported as
 * `savedTimers`, and are never shown as running.
 */
export async function getDeviceStatus(deviceId: string): Promise<DeviceStatusResponse> {
  const device = await getDeviceById(deviceId);
  const fetchedAt = new Date().toISOString();
  if (!device) {
    return { success: false, deviceId, reachable: false, fetchedAt, message: "Device not found." };
  }

  const networkConfig = await getNetworkConfig();
  const res = await espRequest(device, networkConfig, "status");
  if (!res.ok || !res.json) {
    if (device.connectionState !== "offline") await updateDevice(device.id, { connectionState: "offline" });
    return {
      success: true,
      deviceId,
      reachable: false,
      savedTimers: device.timers ?? [],
      fetchedAt,
      message: timerErrorMessage("offline", device.name),
    };
  }

  let timers = parseTimers(res.json);
  if (timers === undefined) {
    const list = await espRequest(device, networkConfig, "timers");
    timers = list.ok ? parseTimers(list.json) ?? [] : [];
  }

  return applyDeviceReport(device.id, {
    power: res.json.power,
    timers,
    raw: res.json,
    fetchedAt,
  });
}

/**
 * Applies a status report (read by the server, or by the browser and posted
 * back) to the app: device power/online state and timer records.
 */
export async function applyDeviceReport(
  deviceId: string,
  report: { power?: unknown; timers: DeviceTimerEntry[]; raw?: Record<string, unknown>; fetchedAt?: string }
): Promise<DeviceStatusResponse> {
  const device = await getDeviceById(deviceId);
  const fetchedAt = report.fetchedAt ?? new Date().toISOString();
  if (!device) {
    return { success: false, deviceId, reachable: false, fetchedAt, message: "Device not found." };
  }

  const power = report.power === "on" || report.power === "off" ? (report.power as PowerState) : undefined;
  if ((power && power !== device.powerState) || device.connectionState !== "connected") {
    await updateDevice(device.id, { ...(power ? { powerState: power } : {}), connectionState: "connected" });
  }

  await reconcileTimerRecords(device.id, report.timers);
  const saved = (await getDeviceById(device.id))?.timers ?? [];
  const raw = report.raw ?? {};

  return {
    success: true,
    deviceId,
    reachable: true,
    power,
    timers: report.timers,
    timerCount: typeof raw.timerCount === "number" ? raw.timerCount : report.timers.length,
    relay: typeof raw.relay === "number" ? raw.relay : undefined,
    ip: typeof raw.ip === "string" ? raw.ip : undefined,
    espDevice: typeof raw.device === "string" ? raw.device : undefined,
    uptime: typeof raw.uptime === "number" ? raw.uptime : undefined,
    rssi: typeof raw.rssi === "number" ? raw.rssi : undefined,
    savedTimers: saved,
    fetchedAt,
  };
}

/** Creates a new timer on the ESP32 (existing timers keep running), then records it. */
export async function startDeviceTimer(
  deviceId: string,
  action: TimerAction,
  seconds: number,
  repeat: boolean
): Promise<DeviceTimerResponse> {
  const device = await getDeviceById(deviceId);
  if (!device) {
    return { success: false, deviceId, reachable: false, reason: "error", targetUrl: "N/A", message: "Device not found." };
  }

  const networkConfig = await getNetworkConfig();
  const query: Record<string, string> = { action, seconds: String(seconds) };
  if (repeat) query.repeat = "true";
  const res = await espRequest(device, networkConfig, "timer", query);

  if (!res.ok) {
    const reason = res.reached ? reasonFromStatus(res.status) : "offline";
    return { success: false, deviceId, reachable: res.reached, reason, targetUrl: res.targetUrl, message: timerErrorMessage(reason, device.name) };
  }

  const created = parseTimerEntry(res.json?.timer) ?? undefined;
  await addTimerRecord(device.id, { espId: created?.id, action, seconds, repeat, startedAt: new Date().toISOString() });

  return {
    success: true,
    deviceId,
    reachable: true,
    created,
    timers: parseTimers(res.json),
    targetUrl: res.targetUrl,
    message: `Timer added on ${device.name}.`,
  };
}

/** Cancels one timer by the id the ESP32 gave it. */
export async function cancelDeviceTimer(deviceId: string, timerId: number): Promise<DeviceTimerResponse> {
  const device = await getDeviceById(deviceId);
  if (!device) {
    return { success: false, deviceId, reachable: false, reason: "error", targetUrl: "N/A", message: "Device not found." };
  }

  const networkConfig = await getNetworkConfig();
  const res = await espRequest(device, networkConfig, "timer/cancel", { id: String(timerId) });

  if (res.ok || (res.reached && res.status === 404)) {
    // 404 = the ESP32 no longer has it (fired or lost); either way it's not running.
    await closeTimerRecords(device.id, [timerId], res.ok ? "cancelled" : "ended");
  }
  if (!res.ok) {
    const reason = res.reached ? reasonFromStatus(res.status) : "offline";
    return { success: false, deviceId, reachable: res.reached, reason, targetUrl: res.targetUrl, message: timerErrorMessage(reason, device.name) };
  }

  return {
    success: true,
    deviceId,
    reachable: true,
    timers: parseTimers(res.json),
    targetUrl: res.targetUrl,
    message: `Timer cancelled on ${device.name}.`,
  };
}

/** Clears every timer on the ESP32 (`/timer/clear`). */
export async function clearDeviceTimers(deviceId: string): Promise<DeviceTimerResponse> {
  const device = await getDeviceById(deviceId);
  if (!device) {
    return { success: false, deviceId, reachable: false, reason: "error", targetUrl: "N/A", message: "Device not found." };
  }

  const networkConfig = await getNetworkConfig();
  const res = await espRequest(device, networkConfig, "timer/clear");
  if (!res.ok) {
    const reason = res.reached ? reasonFromStatus(res.status) : "offline";
    return { success: false, deviceId, reachable: res.reached, reason, targetUrl: res.targetUrl, message: timerErrorMessage(reason, device.name) };
  }

  await closeTimerRecords(device.id, "all", "cancelled");
  return { success: true, deviceId, reachable: true, timers: [], targetUrl: res.targetUrl, message: `All timers cleared on ${device.name}.` };
}

/**
 * Records the result of a timer call the browser made directly to the ESP32
 * (used when the server can't reach the device). Keeps the DB in sync.
 */
export async function recordBrowserTimerResult(
  deviceId: string,
  change:
    | { type: "created"; espId?: number; action: TimerAction; seconds: number; repeat: boolean }
    | { type: "cancelled"; espId: number }
    | { type: "cleared" }
): Promise<void> {
  if (change.type === "created") {
    await addTimerRecord(deviceId, {
      espId: change.espId,
      action: change.action,
      seconds: change.seconds,
      repeat: change.repeat,
      startedAt: new Date().toISOString(),
    });
  } else if (change.type === "cancelled") {
    await closeTimerRecords(deviceId, [change.espId], "cancelled");
  } else {
    await closeTimerRecords(deviceId, "all", "cancelled");
  }
}
