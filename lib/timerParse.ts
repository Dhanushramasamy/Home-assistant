import { DeviceTimerEntry } from "@/types";

/**
 * Parsing for ESP32 timer JSON, shared by the server and the browser.
 * Firmware returns `timers: [{ active, id, action, repeat, seconds, remaining }]`
 * from /status and /timers, and `timer: {...}` for the one just created.
 * Older single-timer firmware (no ids) is read as id 0.
 */
export function parseTimerEntry(raw: unknown, fallbackId?: number): DeviceTimerEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (t.active === false) return null;
  const id = typeof t.id === "number" ? t.id : fallbackId;
  if (id === undefined || (t.action !== "on" && t.action !== "off")) return null;
  return {
    id,
    active: true,
    action: t.action,
    repeat: t.repeat === true,
    seconds: typeof t.seconds === "number" ? t.seconds : 0,
    remaining: typeof t.remaining === "number" ? Math.max(0, t.remaining) : 0,
  };
}

/** Active timers from a /status or /timers body; undefined if the body has none. */
export function parseTimers(json: Record<string, unknown> | null): DeviceTimerEntry[] | undefined {
  if (!json) return undefined;
  if (Array.isArray(json.timers)) {
    return json.timers.map((t) => parseTimerEntry(t)).filter((t): t is DeviceTimerEntry => t !== null);
  }
  if (json.timer && typeof json.timer === "object" && !("id" in (json.timer as object))) {
    const single = parseTimerEntry(json.timer, 0);
    return single ? [single] : [];
  }
  return undefined;
}

/** Human-readable text for an ESP32 timer failure. */
export function timerErrorMessage(
  reason: "offline" | "invalid" | "not_found" | "limit" | "error" | undefined,
  deviceName: string
): string {
  switch (reason) {
    case "offline":
      return `${deviceName} is currently offline.`;
    case "limit":
      return "Maximum of 10 timers are already active on this device.";
    case "not_found":
      return "That timer is no longer running on the device.";
    case "invalid":
      return "Timer settings were rejected. Use 1 second to 24 hours.";
    default:
      return "Timer could not be created.";
  }
}

/** Maps an ESP32 HTTP status to a failure reason. */
export function reasonFromStatus(status: number | undefined): "invalid" | "not_found" | "limit" | "error" {
  if (status === 400) return "invalid";
  if (status === 404) return "not_found";
  if (status === 409) return "limit";
  return "error";
}
