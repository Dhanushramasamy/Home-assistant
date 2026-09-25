"use client";

import { Device, DeviceMode, DeviceStatusResponse, DeviceTimerResponse, DeviceTimerStatus, PowerState, TimerAction } from "@/types";

/**
 * Browser-side helpers for the ESP32 timer. Each call goes through the app's
 * API first (works when the server is on the same network as the ESP32). In
 * direct mode, if the server can't reach the device, it falls back to calling
 * the ESP32 from the browser, the same way ON/OFF already does.
 */

const BROWSER_TIMEOUT_MS = 3000;

function isDirect(device: Device, networkMode?: DeviceMode) {
  return networkMode !== "gateway" && device.mode !== "gateway";
}

async function browserFetchJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), BROWSER_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", mode: "cors", cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function toTimer(raw: unknown): DeviceTimerStatus {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    active: t.active === true,
    action: t.action === "on" || t.action === "off" ? t.action : undefined,
    repeat: typeof t.repeat === "boolean" ? t.repeat : undefined,
    seconds: typeof t.seconds === "number" ? t.seconds : undefined,
    remaining: typeof t.remaining === "number" ? t.remaining : undefined,
  };
}

export async function fetchDeviceStatus(device: Device, networkMode?: DeviceMode): Promise<DeviceStatusResponse> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(`/api/devices/status?deviceId=${encodeURIComponent(device.id)}`, { cache: "no-store" });
    const data = (await res.json()) as DeviceStatusResponse;
    if (data.reachable || !isDirect(device, networkMode)) return data;
  } catch {}

  if (isDirect(device, networkMode)) {
    const json = await browserFetchJson(`http://${device.ip}/status`);
    if (json && json.ok !== false) {
      return {
        success: true,
        deviceId: device.id,
        reachable: true,
        power: json.power === "on" || json.power === "off" ? (json.power as PowerState) : undefined,
        timer: toTimer(json.timer),
        espDevice: typeof json.device === "string" ? json.device : undefined,
        fetchedAt,
      };
    }
  }
  return { success: true, deviceId: device.id, reachable: false, fetchedAt };
}

export async function requestStartTimer(
  device: Device,
  networkMode: DeviceMode | undefined,
  timer: { action: TimerAction; seconds: number; repeat: boolean }
): Promise<DeviceTimerResponse> {
  let serverResult: DeviceTimerResponse | null = null;
  try {
    const res = await fetch("/api/devices/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id, ...timer }),
    });
    serverResult = (await res.json()) as DeviceTimerResponse;
    if (serverResult.reachable || !isDirect(device, networkMode)) return serverResult;
  } catch {}

  const qs = new URLSearchParams({ action: timer.action, seconds: String(timer.seconds) });
  if (timer.repeat) qs.set("repeat", "true");
  const url = `http://${device.ip}/timer?${qs}`;
  const json = await browserFetchJson(url);
  if (json && json.ok !== false) {
    return { success: true, deviceId: device.id, reachable: true, timer: toTimer(json.timer), targetUrl: url, message: "Timer set." };
  }
  return (
    serverResult ?? {
      success: false,
      deviceId: device.id,
      reachable: false,
      targetUrl: url,
      message: "Could not reach the device.",
    }
  );
}

export async function requestCancelTimer(device: Device, networkMode?: DeviceMode): Promise<DeviceTimerResponse> {
  let serverResult: DeviceTimerResponse | null = null;
  try {
    const res = await fetch("/api/devices/timer/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id }),
    });
    serverResult = (await res.json()) as DeviceTimerResponse;
    if (serverResult.reachable || !isDirect(device, networkMode)) return serverResult;
  } catch {}

  const url = `http://${device.ip}/timer/cancel`;
  const json = await browserFetchJson(url);
  if (json && json.ok !== false) {
    return { success: true, deviceId: device.id, reachable: true, timer: { active: false }, targetUrl: url, message: "Timer cancelled." };
  }
  return (
    serverResult ?? {
      success: false,
      deviceId: device.id,
      reachable: false,
      targetUrl: url,
      message: "Could not reach the device.",
    }
  );
}

/** Seconds left right now, counting down locally from the last ESP32 sync. */
export function remainingNow(timer: DeviceTimerStatus | undefined, syncedAt: number, now: number): number {
  if (!timer?.active || typeof timer.remaining !== "number") return 0;
  const left = timer.remaining - Math.floor((now - syncedAt) / 1000);
  if (left > 0) return left;
  if (timer.repeat && timer.seconds) return ((left % timer.seconds) + timer.seconds) % timer.seconds || timer.seconds;
  return 0;
}

export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (sec || parts.length === 0) parts.push(`${sec} s`);
  return parts.join(" ");
}

/** Seconds from `now` until the next occurrence of a "HH:MM" clock time (today or tomorrow). */
export function secondsUntilClock(hhmm: string, now: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now) / 1000);
}
