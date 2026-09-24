import { getDeviceById, updateDevice } from "./deviceStore";
import { getNetworkConfig } from "./networkStore";
import {
  DeviceControlResponse,
  TestConnectionResponse,
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
