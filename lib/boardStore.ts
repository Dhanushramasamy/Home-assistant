import { CloudBoard, PowerState } from "@/types";
import { supabase } from "./supabaseClient";
import { powerForRelay } from "./timerParse";

// Cloud control (supabase/add_cloud_boards.sql). Each ESP32 board keeps a
// live connection to Supabase: the app writes `desired`, the board switches
// its relay and writes back its /status JSON as `reported`.
const BOARD_TABLE = "esp_board_prb_home_assistant";

/** Boards check in every 60 s; after this long without one they're offline. */
export const BOARD_ONLINE_MS = 150_000;

interface BoardRow {
  board_id: string;
  name: string | null;
  auth_user_id: string | null;
  desired: Record<string, string> | null;
  desired_at: string | null;
  reported: Record<string, unknown> | null;
  reported_at: string | null;
  ip: string | null;
  ssid: string | null;
  rssi: number | null;
  last_seen: string | null;
}

export interface BoardState {
  online: boolean;
  /** The board's /status JSON, with timer countdowns moved on to now. */
  report: Record<string, unknown> | null;
  lastSeen: string | null;
}

export class BoardSetupError extends Error {}

export const BOARD_SETUP_MESSAGE =
  "Cloud boards aren't set up yet. Run supabase/add_cloud_boards.sql in the Supabase SQL editor.";

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? ""));
}

function isOnline(row: BoardRow): boolean {
  return !!row.last_seen && Date.now() - new Date(row.last_seen).getTime() < BOARD_ONLINE_MS;
}

/** A command the board hasn't confirmed yet counts for this long. */
const PENDING_MS = 15_000;

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

// Right after a tap the board's last report still has the old state. Until it
// reports again (normally about a second), the command it was sent counts.
function withPending(row: BoardRow, report: Record<string, unknown>): Record<string, unknown> {
  const desired = row.desired ?? {};
  const pending = ms(row.desired_at) > ms(row.reported_at) && Date.now() - ms(row.desired_at) < PENDING_MS;
  if (!pending || Object.keys(desired).length === 0) return report;
  const relayNumbers = new Set<number>(Object.keys(desired).map(Number).filter((n) => n > 0));
  for (const key of Object.keys(report)) {
    const m = /^relay(\d+)$/.exec(key);
    if (m) relayNumbers.add(Number(m[1]));
  }
  if (Array.isArray(report.relays)) {
    for (const r of report.relays) {
      const n = (r as Record<string, unknown>)?.relay;
      if (typeof n === "number") relayNumbers.add(n);
    }
  }
  const relays = [...relayNumbers].sort((a, b) => a - b).map((relay) => ({
    relay,
    power: desired[String(relay)] === "on" || desired[String(relay)] === "off" ? desired[String(relay)] : powerForRelay(report, relay),
  }));
  return { ...report, relays };
}

// Timers in `reported` were counted down when the board sent it; move them on
// by the time since, so countdowns match the board.
function reportNow(row: BoardRow): Record<string, unknown> | null {
  if (!row.reported) return null;
  const ageSec = row.reported_at ? Math.max(0, Math.floor((Date.now() - new Date(row.reported_at).getTime()) / 1000)) : 0;
  const timers = Array.isArray(row.reported.timers) ? row.reported.timers : undefined;
  if (!timers || ageSec === 0) return withPending(row, row.reported);
  const moved: unknown[] = [];
  for (const t of timers) {
    const entry = t as Record<string, unknown>;
    if (!entry || typeof entry !== "object" || typeof entry.remaining !== "number") {
      moved.push(t);
      continue;
    }
    const seconds = typeof entry.seconds === "number" ? entry.seconds : 0;
    let remaining = entry.remaining - ageSec;
    if (remaining <= 0) {
      // A one-shot timer has fired; a repeating one has started over.
      if (entry.repeat !== true || seconds <= 0) continue;
      remaining = ((remaining % seconds) + seconds) % seconds || seconds;
    }
    moved.push({ ...entry, remaining });
  }
  return withPending(row, { ...row.reported, timers: moved });
}

// Several relays on one board share a read within the same moment.
const readCache = new Map<string, { at: number; promise: Promise<BoardRow | null> }>();
const READ_SHARE_MS = 1000;

async function readBoard(boardId: string): Promise<BoardRow | null> {
  const cached = readCache.get(boardId);
  if (cached && Date.now() - cached.at < READ_SHARE_MS) return cached.promise;
  const promise = (async () => {
    const { data, error } = await supabase.from(BOARD_TABLE).select("*").eq("board_id", boardId).maybeSingle();
    if (isMissingTable(error)) throw new BoardSetupError(BOARD_SETUP_MESSAGE);
    if (error) throw new Error(error.message);
    return (data as BoardRow | null) ?? null;
  })();
  readCache.set(boardId, { at: Date.now(), promise });
  promise.catch(() => readCache.delete(boardId));
  return promise;
}

/** Current state of a board, or null if there's no such board. */
export async function getBoardState(boardId: string): Promise<BoardState | null> {
  const row = await readBoard(boardId);
  if (!row) return null;
  return { online: isOnline(row), report: reportNow(row), lastSeen: row.last_seen };
}

/** Asks a board to switch one relay. False if the board doesn't exist. */
export async function setBoardRelay(boardId: string, relay: number, power: Exclude<PowerState, "unknown">): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_board_relay", { p_board: boardId, p_relay: relay, p_power: power });
  if (isMissingTable(error) || error?.code === "PGRST202") throw new BoardSetupError(BOARD_SETUP_MESSAGE);
  if (error) throw new Error(error.message);
  readCache.delete(boardId);
  return data === true;
}

/** Every board, for Settings → Network. */
export async function listBoards(): Promise<CloudBoard[]> {
  const { data, error } = await supabase.from(BOARD_TABLE).select("*").order("board_id");
  if (isMissingTable(error)) throw new BoardSetupError(BOARD_SETUP_MESSAGE);
  if (error) throw new Error(error.message);
  return ((data as BoardRow[] | null) ?? []).map((row) => ({
    boardId: row.board_id,
    name: row.name,
    online: isOnline(row),
    linked: !!row.auth_user_id,
    ip: row.ip,
    ssid: row.ssid,
    rssi: row.rssi,
    lastSeen: row.last_seen,
    desired: row.desired ?? {},
  }));
}

/** Power of every relay on the given boards, from their last report. */
export async function reportedPower(boardIds: string[]): Promise<Map<string, { online: boolean; report: Record<string, unknown> | null }>> {
  const result = new Map<string, { online: boolean; report: Record<string, unknown> | null }>();
  if (boardIds.length === 0) return result;
  const { data, error } = await supabase.from(BOARD_TABLE).select("*").in("board_id", boardIds);
  if (error) return result;
  for (const row of (data as BoardRow[] | null) ?? []) {
    result.set(row.board_id, { online: isOnline(row), report: reportNow(row) });
  }
  return result;
}
