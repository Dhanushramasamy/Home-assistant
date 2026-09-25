"use client";

import { Device, DeviceMode, DeviceStatusResponse, DeviceTimerEntry, DeviceTimerResponse, TimerAction } from "@/types";
import { parseTimerEntry, parseTimers, reasonFromStatus, timerErrorMessage } from "./timerParse";

/**
 * Browser-side helpers for ESP32 status and timers. Each call goes through
 * the app's API first (works when the server is on the same network as the
 * ESP32). In direct mode, if the server can't reach the device, the browser
 * calls the ESP32 itself, the same way ON/OFF already does, and then reports
 * the result to the API so the database stays in sync.
 *
 * Direct calls are plain GETs with no custom headers, so they don't need a
 * CORS preflight (the firmware still answers OPTIONS with 204 if one is sent).
 */

const BROWSER_TIMEOUT_MS = 3000;

function isDirect(device: Device, networkMode?: DeviceMode) {
  return networkMode !== "gateway" && device.mode !== "gateway";
}

interface BrowserResult {
  reached: boolean;
  status: number;
  json: Record<string, unknown> | null;
}

async function browserGet(url: string): Promise<BrowserResult> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), BROWSER_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", mode: "cors", signal: controller.signal });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { reached: true, status: res.status, json };
  } catch {
    return { reached: false, status: 0, json: null };
  } finally {
    clearTimeout(id);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function browserFailure(device: Device, r: BrowserResult, url: string): DeviceTimerResponse {
  const reason = r.reached ? reasonFromStatus(r.status) : "offline";
  return { success: false, deviceId: device.id, reachable: r.reached, reason, targetUrl: url, message: timerErrorMessage(reason, device.name) };
}

/** Reads the ESP32's /status (the source of truth) and syncs the app to it. */
export async function fetchDeviceStatus(device: Device, networkMode?: DeviceMode): Promise<DeviceStatusResponse> {
  let serverResult: DeviceStatusResponse | null = null;
  try {
    const res = await fetch(`/api/devices/status?deviceId=${encodeURIComponent(device.id)}`, { cache: "no-store" });
    serverResult = (await res.json()) as DeviceStatusResponse;
    if (serverResult.reachable || !isDirect(device, networkMode)) return serverResult;
  } catch {}

  const r = await browserGet(`http://${device.ip}/status`);
  if (r.reached && r.json && r.json.ok !== false) {
    // Let the server reconcile the DB with what the browser saw.
    const synced = await postJson<DeviceStatusResponse>("/api/devices/status", { deviceId: device.id, report: r.json });
    if (synced?.success) return synced;
    return {
      success: true,
      deviceId: device.id,
      reachable: true,
      power: r.json.power === "on" || r.json.power === "off" ? r.json.power : undefined,
      timers: parseTimers(r.json) ?? [],
      fetchedAt: new Date().toISOString(),
    };
  }
  return serverResult ?? { success: true, deviceId: device.id, reachable: false, fetchedAt: new Date().toISOString() };
}

export async function requestStartTimer(
  device: Device,
  networkMode: DeviceMode | undefined,
  timer: { action: TimerAction; seconds: number; repeat: boolean }
): Promise<DeviceTimerResponse> {
  const serverResult = await postJson<DeviceTimerResponse>("/api/devices/timer", { deviceId: device.id, ...timer });
  // Only retry from the browser when the server couldn't reach the ESP32 at all.
  if (serverResult && (serverResult.success || serverResult.reachable || !isDirect(device, networkMode))) return serverResult;

  const qs = new URLSearchParams({ action: timer.action, seconds: String(timer.seconds) });
  if (timer.repeat) qs.set("repeat", "true");
  const url = `http://${device.ip}/timer?${qs}`;
  const r = await browserGet(url);
  if (!r.reached || !r.json || r.status >= 400 || r.json.ok === false) return browserFailure(device, r, url);

  const created = parseTimerEntry(r.json.timer) ?? undefined;
  await postJson("/api/devices/timer", { deviceId: device.id, ...timer, recordOnly: true, espTimerId: created?.id });
  return { success: true, deviceId: device.id, reachable: true, created, timers: parseTimers(r.json), targetUrl: url, message: "Timer added." };
}

/** Cancels one timer by the id the ESP32 generated for it. */
export async function requestCancelTimer(device: Device, networkMode: DeviceMode | undefined, timerId: number): Promise<DeviceTimerResponse> {
  const serverResult = await postJson<DeviceTimerResponse>("/api/devices/timer/cancel", { deviceId: device.id, timerId });
  if (serverResult && (serverResult.success || serverResult.reachable || !isDirect(device, networkMode))) return serverResult;

  const url = `http://${device.ip}/timer/cancel?id=${timerId}`;
  const r = await browserGet(url);
  if (!r.reached || !r.json || r.status >= 400 || r.json.ok === false) return browserFailure(device, r, url);

  await postJson("/api/devices/timer/cancel", { deviceId: device.id, timerId, recordOnly: true });
  return { success: true, deviceId: device.id, reachable: true, timers: parseTimers(r.json), targetUrl: url, message: "Timer cancelled." };
}

/** Clears every timer on the ESP32 (GET /timer/clear). */
export async function requestClearTimers(device: Device, networkMode?: DeviceMode): Promise<DeviceTimerResponse> {
  const serverResult = await postJson<DeviceTimerResponse>("/api/devices/timer/clear", { deviceId: device.id });
  if (serverResult && (serverResult.success || serverResult.reachable || !isDirect(device, networkMode))) return serverResult;

  const url = `http://${device.ip}/timer/clear`;
  const r = await browserGet(url);
  if (!r.reached || !r.json || r.status >= 400 || r.json.ok === false) return browserFailure(device, r, url);

  await postJson("/api/devices/timer/clear", { deviceId: device.id, recordOnly: true });
  return { success: true, deviceId: device.id, reachable: true, timers: [], targetUrl: url, message: "All timers cleared." };
}

/**
 * Seconds left right now for one timer, counting down locally from the last
 * ESP32 sync. Only for display; the next sync replaces it with the real value.
 */
export function remainingNow(timer: DeviceTimerEntry | undefined, syncedAt: number, now: number): number {
  if (!timer) return 0;
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
