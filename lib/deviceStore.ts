import { DEFAULT_SERVO_OFF_ANGLE, DEFAULT_SERVO_ON_ANGLE, DEFAULT_SERVO_SPEED_DPS, Device, DeviceTimerConfig } from "@/types";
import { supabase } from "./supabaseClient";
import { allBoardStates, BoardState } from "./boardStore";
import { powerForRelay } from "./timerParse";

// Switches (one per light / fan tile) live in the `switches` table. Their
// ON/OFF and online state is not stored there: cloud switches take it from
// their board's live report (`boards`), direct-IP switches from the last
// /status the server read (kept in memory). See supabase/four_tables.sql.
const SWITCH_TABLE = "switches";

export const INITIAL_DEVICES: Device[] = [
  {
    id: "bedroom-light",
    name: "Bedroom Light",
    room: "Bedroom",
    type: "light",
    mode: "direct",
    ip: "192.168.1.200",
    relay: 1,
    boardId: null,
    powerState: "off",
    connectionState: "connected",
  },
  {
    id: "bedroom-fan",
    name: "Bedroom Fan",
    room: "Bedroom",
    type: "fan",
    mode: "direct",
    ip: "192.168.1.200",
    relay: 2,
    boardId: null,
    powerState: "off",
    connectionState: "connected",
  },
];

interface SwitchRow {
  id: string;
  name: string;
  room: string;
  type: Device["type"];
  board_id: string | null;
  relay: number;
  ip: string | null;
  servo_on_angle?: number | null;
  servo_off_angle?: number | null;
  servo_speed_dps?: number | null;
}

type LiveState = Pick<Device, "powerState" | "connectionState" | "lastSeen">;

// Not stored in the database: last known state of direct-IP switches, and the
// timers this server scheduled (the board's report is the real list).
const liveState = new Map<string, LiveState>();
const timerRecords = new Map<string, DeviceTimerConfig[]>();
let lastGood: Device[] | null = null;

// One request reads the switch list several times; share a read for a moment.
const SHARE_MS = 1000;
let shared: { at: number; promise: Promise<Device[]> } | null = null;

/** Next getDevices() reads the database again (call after any write). */
export function invalidateDevices() {
  shared = null;
}

/** Timers this server knows were scheduled on a switch (memory only). */
export function timerNotes(deviceId: string): DeviceTimerConfig[] {
  return timerRecords.get(deviceId) ?? [];
}

function toDevice(row: SwitchRow, boards: Map<string, BoardState>): Device {
  const relay = row.relay || 1;
  const live = liveState.get(row.id);
  let powerState: Device["powerState"] = live?.powerState ?? "off";
  let connectionState: Device["connectionState"] = live?.connectionState ?? "connected";
  let lastSeen = live?.lastSeen;
  let servoAngle: number | undefined;
  let servoTargetAngle: number | undefined;
  let servoMoving: boolean | undefined;
  let servoPowerState: Device["powerState"] = "unknown";

  const boardReport = row.board_id ? boards.get(row.board_id)?.report : undefined;
  if (row.board_id) {
    const board = boards.get(row.board_id);
    connectionState = board?.online ? "connected" : "offline";
    // When offline the last report is still the last known state.
    if (row.type === "servo") {
      const servoReport = board?.report?.servo as { angle?: unknown; targetAngle?: unknown; moving?: unknown } | undefined;
      const angle = servoReport?.angle;
      servoAngle = typeof angle === "number" ? angle : undefined;
      const target = typeof servoReport?.targetAngle === "number" ? servoReport.targetAngle : angle;
      servoTargetAngle = typeof target === "number" ? target : undefined;
      servoMoving = typeof servoReport?.moving === "boolean" ? servoReport.moving : undefined;
      const onAngle = row.servo_on_angle ?? DEFAULT_SERVO_ON_ANGLE;
      const offAngle = row.servo_off_angle ?? DEFAULT_SERVO_OFF_ANGLE;
      // An idle servo can report an intermediate angle (for example after a
      // restart or a manual movement). Keep the toggle usable in that case;
      // the card reserves its loader for an active movement or command.
      servoPowerState = target === onAngle
        ? "on"
        : target === offAngle ? "off" : servoMoving === true ? "unknown" : "off";
      powerState = servoPowerState;
    } else {
      powerState = (board?.report ? powerForRelay(board.report, relay) : undefined) ?? powerState;
    }
    lastSeen = board?.lastSeen ?? lastSeen;
  }

  return {
    id: row.id,
    name: row.name,
    room: row.room,
    type: row.type,
    mode: "direct",
    // Cloud boards get their address from the Wi-Fi; use the one they report.
    ip: (typeof boardReport?.ip === "string" && boardReport.ip) || row.ip || "",
    relay,
    boardId: row.board_id,
    powerState,
    ...(servoAngle !== undefined ? { servoAngle } : {}),
    servoOnAngle: row.servo_on_angle ?? DEFAULT_SERVO_ON_ANGLE,
    servoOffAngle: row.servo_off_angle ?? DEFAULT_SERVO_OFF_ANGLE,
    servoSpeedDps: row.servo_speed_dps ?? DEFAULT_SERVO_SPEED_DPS,
    ...(servoTargetAngle !== undefined ? { servoTargetAngle } : {}),
    ...(servoMoving !== undefined ? { servoMoving } : {}),
    connectionState,
    lastSeen: lastSeen ?? undefined,
    timers: timerRecords.get(row.id) ?? [],
  };
}

function toRow(d: Pick<Device, "id" | "name" | "room" | "type" | "relay" | "ip"> & Pick<Partial<Device>, "servoOnAngle" | "servoOffAngle" | "servoSpeedDps"> & { boardId?: string | null }) {
  return {
    id: d.id,
    name: d.name,
    room: d.room || "General",
    type: d.type,
    board_id: d.boardId || null,
    relay: d.relay || 1,
    ip: d.ip || null,
    servo_on_angle: d.servoOnAngle ?? DEFAULT_SERVO_ON_ANGLE,
    servo_off_angle: d.servoOffAngle ?? DEFAULT_SERVO_OFF_ANGLE,
    servo_speed_dps: d.servoSpeedDps ?? DEFAULT_SERVO_SPEED_DPS,
  };
}

export async function getDevices(): Promise<Device[]> {
  if (shared && Date.now() - shared.at < SHARE_MS) return shared.promise;
  const promise = readDevices();
  shared = { at: Date.now(), promise };
  return promise;
}

async function readDevices(): Promise<Device[]> {
  try {
    const [{ data, error }, boards] = await Promise.all([
      supabase.from(SWITCH_TABLE).select("*").order("created_at", { ascending: true }),
      allBoardStates(),
    ]);
    if (error) throw new Error(error.message);
    lastGood = ((data as SwitchRow[] | null) ?? []).map((row) => toDevice(row, boards));
    return lastGood;
  } catch (err) {
    console.warn("Switches fetch notice:", err);
    return lastGood ?? INITIAL_DEVICES;
  }
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const devices = await getDevices();
  return devices.find((d) => d.id === id) || null;
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

  const { error } = await supabase.from(SWITCH_TABLE).insert(toRow({ ...newDeviceData, id: uniqueId }));
  invalidateDevices();
  if (error) throw new Error(error.code === "23505"
    ? newDeviceData.type === "servo" ? "That board already has a servo device." : "That board already has a switch on this relay."
    : newDeviceData.type === "servo" && (error.code === "42703" || error.code === "PGRST204")
      ? "Run supabase/add_servo_motion_settings.sql in the Supabase SQL Editor, then add the servo again."
      : error.message);

  liveState.set(uniqueId, {
    powerState: newDeviceData.powerState || "off",
    connectionState: newDeviceData.connectionState || "connected",
  });
  return (await getDeviceById(uniqueId)) as Device;
}

const STORED_FIELDS = ["name", "room", "type", "relay", "ip", "boardId", "servoOnAngle", "servoOffAngle", "servoSpeedDps"] as const;

/**
 * Updates a switch. Name, room, type, relay, IP and board are saved in the
 * database; power / online state and timers only in memory.
 */
export async function updateDevice(id: string, updates: Partial<Device>): Promise<Device | null> {
  const devices = await getDevices();
  const current = devices.find((d) => d.id === id);
  if (!current) return null;
  const merged: Device = { ...current, ...updates, lastSeen: new Date().toISOString() };

  if (STORED_FIELDS.some((f) => f in updates && updates[f] !== current[f])) {
    const { error } = await supabase.from(SWITCH_TABLE).update(toRow(merged)).eq("id", id);
    invalidateDevices();
    if (error) throw new Error(error.code === "23505"
      ? merged.type === "servo" ? "That board already has a servo device." : "That board already has a switch on this relay."
      : merged.type === "servo" && (error.code === "42703" || error.code === "PGRST204")
        ? "Run supabase/add_servo_motion_settings.sql in the Supabase SQL Editor, then save the servo again."
        : error.message);
  }

  if ("powerState" in updates || "connectionState" in updates) {
    liveState.set(id, { powerState: merged.powerState, connectionState: merged.connectionState, lastSeen: merged.lastSeen });
  }
  if ("timers" in updates) timerRecords.set(id, updates.timers ?? []);

  if (lastGood) lastGood = lastGood.map((d) => (d.id === id ? merged : d));
  if (shared) shared = { at: shared.at, promise: Promise.resolve(lastGood ?? [merged]) };
  return merged;
}

export async function deleteDevice(id: string): Promise<boolean> {
  const { data, error } = await supabase.from(SWITCH_TABLE).delete().eq("id", id).select("id");
  invalidateDevices();
  if (error) throw new Error(error.message);
  liveState.delete(id);
  timerRecords.delete(id);
  return (data ?? []).length > 0;
}

/** Admin "reset": replaces every switch with the two defaults. */
export async function resetDevicesToDefault(): Promise<Device[]> {
  await clearAllDevices();
  const { error } = await supabase.from(SWITCH_TABLE).insert(INITIAL_DEVICES.map(toRow));
  if (error) throw new Error(error.message);
  return getDevices();
}

export async function clearAllDevices(): Promise<Device[]> {
  const { error } = await supabase.from(SWITCH_TABLE).delete().neq("id", "");
  invalidateDevices();
  if (error) throw new Error(error.message);
  liveState.clear();
  timerRecords.clear();
  return [];
}

/* ------------------------------------------------------------------ */
/* Timer notes (memory only)                                           */
/* ------------------------------------------------------------------ */
// What this server scheduled, so an offline device can still show "you set
// these". The board's /status (or cloud report) is always the real list.

/** Remembers a timer the ESP32 accepted (espId = the id the ESP32 returned). */
export async function addTimerRecord(deviceId: string, timer: Omit<DeviceTimerConfig, "recordId">): Promise<void> {
  timerRecords.set(deviceId, [...(timerRecords.get(deviceId) ?? []), timer]);
}

/** Forgets timers. `espIds` = the ESP32 ids to forget, or "all". */
export async function closeTimerRecords(deviceId: string, espIds: number[] | "all"): Promise<void> {
  if (espIds === "all") {
    timerRecords.delete(deviceId);
    return;
  }
  const current = timerRecords.get(deviceId) ?? [];
  timerRecords.set(deviceId, current.filter((t) => t.espId === undefined || !espIds.includes(t.espId)));
}

/** Matches the notes to what the ESP32 reports is running. */
export async function reconcileTimerRecords(
  deviceId: string,
  running: { id: number; action: "on" | "off"; seconds: number; repeat: boolean; remaining: number }[]
): Promise<void> {
  const known = timerRecords.get(deviceId) ?? [];
  timerRecords.set(
    deviceId,
    running.map((t) => {
      const note = known.find((k) => k.espId === t.id);
      return (
        note ?? {
          espId: t.id,
          action: t.action,
          seconds: t.seconds,
          repeat: t.repeat,
          // Best estimate of when it started, from what's left on the device.
          startedAt: new Date(Date.now() - Math.max(0, t.seconds - t.remaining) * 1000).toISOString(),
        }
      );
    })
  );
}
