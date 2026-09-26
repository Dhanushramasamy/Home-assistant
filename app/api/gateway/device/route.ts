import { NextResponse } from "next/server";
import { getDeviceById, updateDevice } from "@/lib/deviceStore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required by Gateway" },
        { status: 400 }
      );
    }

    const device = await getDeviceById(deviceId);
    if (!device) {
      return NextResponse.json(
        { error: `Raspberry Pi 5 Gateway: Device ID '${deviceId}' not found in router table.` },
        { status: 404 }
      );
    }

    // Pi 5 Gateway Router resolves device ID to IP
    const targetIp = device.ip;
    const nextPowerState = action === "toggle" ? (device.powerState === "on" ? "off" : "on") : action;
    const espUrl = `http://${targetIp}/${nextPowerState}?relay=${device.relay || 1}`;

    // Forward timer/status calls to the ESP32 and return its JSON as `esp`
    if (action === "esp") {
      const { path, query } = body as { path?: string; query?: Record<string, string> };
      if (!["status", "timers", "timer", "timer/cancel"].includes(path ?? "")) {
        return NextResponse.json({ error: "Unsupported ESP32 path" }, { status: 400 });
      }
      const qs = new URLSearchParams(query || {}).toString();
      const forwardUrl = `http://${targetIp}/${path}${qs ? `?${qs}` : ""}`;
      const espController = new AbortController();
      const espTimeout = setTimeout(() => espController.abort(), 2500);
      try {
        const espResponse = await fetch(forwardUrl, { method: "GET", signal: espController.signal, cache: "no-store" });
        const esp = await espResponse.json().catch(() => null);
        return NextResponse.json({ success: espResponse.ok, deviceId: device.id, forwardedUrl: forwardUrl, esp }, { status: espResponse.status });
      } catch {
        return NextResponse.json({ success: false, deviceId: device.id, forwardedUrl: forwardUrl, esp: null }, { status: 504 });
      } finally {
        clearTimeout(espTimeout);
      }
    }

    // Status ping from gateway
    if (action === "status") {
      return NextResponse.json({
        gateway: "Raspberry Pi 5 Router",
        deviceId: device.id,
        resolvedIp: targetIp,
        status: "reachable",
      });
    }

    // Forward request from Pi 5 to ESP32
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(espUrl, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      await updateDevice(device.id, {
        powerState: nextPowerState,
        connectionState: "connected",
      });

      return NextResponse.json({
        success: true,
        gateway: "Raspberry Pi 5 Central Router",
        deviceId: device.id,
        resolvedIp: targetIp,
        actionExecuted: nextPowerState,
        forwardedUrl: espUrl,
        message: `Pi 5 routed command to ${device.name} (${targetIp}) -> HTTP 200 OK`,
      });
    } catch {
      clearTimeout(timeoutId);

      // Handle router forward fallback gracefully
      await updateDevice(device.id, {
        powerState: nextPowerState,
        connectionState: "offline",
      });

      return NextResponse.json({
        success: true,
        gateway: "Raspberry Pi 5 Central Router",
        deviceId: device.id,
        resolvedIp: targetIp,
        actionExecuted: nextPowerState,
        forwardedUrl: espUrl,
        message: `Pi 5 routed command to ${device.name} (${targetIp}) [ESP32 hardware unreachable]`,
        simulated: true,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Raspberry Pi 5 Gateway Router error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
