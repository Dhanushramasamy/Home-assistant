import { Device, DeviceTimerConfig } from "@/types";
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
}

type LiveState = Pick<Device, "powerState" | "connectionState" | "lastSeen">;

// Not stored in the database: last known state of direct-IP switches, and the
// timers this server scheduled (the board's report is the real list).
const liveState = new Map<string, LiveState>();
const timerRecords = new Map<string, DeviceTimerConfig[]>();
let lastGood: Device[] | null = null;

function toDevice(row: SwitchRow, boards: Map<string, BoardState>): Device {
  const relay = row.relay || 1;
  const live = liveState.get(row.id);
  let powerState: Device["powerState"] = live?.powerState ?? "off";
  let connectionState: Device["connectionState"] = live?.connectionState ?? "connected";
  let lastSeen = live?.lastSeen;

  if (row.board_id) {
    const board = boards.get(row.board_id);
    connectionState = board?.online ? "connected" : "offline";
    // When offline the last report is still the last known state.
    powerState = (board?.report ? powerForRelay(board.report, relay) : undefined) ?? powerState;
    lastSeen = board?.lastSeen ?? lastSeen;
  }

  return {
    id: row.id,
    name: row.name,
    room: row.room,
    type: row.type,
    mode: "direct",
    ip: row.ip ?? "",
    relay,
    boardId: row.board_id,
    powerState,
    connectionState,
    lastSeen: lastSeen ?? undefined,
    timers: timerRecords.get(row.id) ?? [],
  };
}

function toRow(d: Pick<Device, "id" | "name" | "room" | "type" | "relay" | "ip"> & { boardId?: string | null }) {
  return {
    id: d.id,
    name: d.name,
    room: d.room || "General",
    type: d.type,
    board_id: d.boardId || null,
    relay: d.relay || 1,
    ip: d.ip || null,
  };
}

export async function getDevices(): Promise<Device[]> {
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
  if (error) throw new Error(error.code === "23505" ? "That board already has a switch on this relay." : error.message);

  liveState.set(uniqueId, {
    powerState: newDeviceData.powerState || "off",
    connectionState: newDeviceData.connectionState || "connected",
  });
  return (await getDeviceById(uniqueId)) as Device;
}

const STORED_FIELDS = ["name", "room", "type", "relay", "ip", "boardId"] as const;

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
    if (error) throw new Error(error.code === "23505" ? "That board already has a switch on this relay." : error.message);
  }

  if ("powerState" in updates || "connectionState" in updates) {
    liveState.set(id, { powerState: merged.powerState, connectionState: merged.connectionState, lastSeen: merged.lastSeen });
  }
  if ("timers" in updates) timerRecords.set(id, updates.timers ?? []);

  if (lastGood) lastGood = lastGood.map((d) => (d.id === id ? merged : d));
  return merged;
}

export async function deleteDevice(id: string): Promise<boolean> {
  const { data, error } = await supabase.from(SWITCH_TABLE).delete().eq("id", id).select("id");
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
