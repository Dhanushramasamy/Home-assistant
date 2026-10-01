import { CloudBoard, PowerState } from "@/types";
import { supabase } from "./supabaseClient";
import { powerForRelay } from "./timerParse";

// Cloud control (`boards` table, supabase/four_tables.sql). Each ESP32 board
// keeps a live connection to Supabase: the app writes `desired` (relays) and
// `commands` (timers), the board acts and writes back its /status JSON as
// `reported`.
const BOARD_TABLE = "boards";

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
  // From supabase/board_setup.sql (missing before it's run).
  relay_pins?: number[] | null;
  relay_active_low?: boolean | null;
  wifi?: { ssid: string; priority: number; password?: string | null }[] | null;
}

export interface BoardState {
  online: boolean;
  /** A relay change the board hasn't reported back yet (report shows the asked-for state). */
  pending: boolean;
  /** The board's /status JSON, with timer countdowns moved on to now. */
  report: Record<string, unknown> | null;
  lastSeen: string | null;
}

export class BoardSetupError extends Error {}

export const BOARD_SETUP_MESSAGE =
  "Cloud boards aren't set up yet. Run supabase/four_tables.sql in the Supabase SQL editor.";

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? ""));
}

function isOnline(row: BoardRow): boolean {
  return !!row.last_seen && Date.now() - new Date(row.last_seen).getTime() < BOARD_ONLINE_MS;
}

/** A command the board hasn't confirmed yet counts for this long. */
const PENDING_MS = 15_000;

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

function isPending(row: BoardRow): boolean {
  return ms(row.desired_at) > ms(row.reported_at) && Date.now() - ms(row.desired_at) < PENDING_MS;
}

// Right after a tap the board's last report still has the old state. Until it
// reports again (normally about a second), the command it was sent counts.
function withPending(row: BoardRow, report: Record<string, unknown>): Record<string, unknown> {
  const desired = row.desired ?? {};
  const pending = isPending(row);
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
  return { online: isOnline(row), pending: isPending(row), report: reportNow(row), lastSeen: row.last_seen };
}

/** Asks a board to switch one relay. False if the board doesn't exist. */
export async function setBoardRelay(boardId: string, relay: number, power: Exclude<PowerState, "unknown">): Promise<boolean> {
  const { data, error } = await supabase.rpc("board_set_relay", { p_board: boardId, p_relay: relay, p_power: power });
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
    relayPins: row.relay_pins ?? [],
    relayActiveLow: row.relay_active_low !== false,
    wifi: [...(row.wifi ?? [])]
      .sort((a, b) => a.priority - b.priority)
      .map((w) => ({ ssid: w.ssid, priority: w.priority, hasPassword: !!w.password })),
    online: isOnline(row),
    linked: !!row.auth_user_id,
    ip: row.ip,
    ssid: row.ssid,
    rssi: row.rssi,
    lastSeen: row.last_seen,
    desired: row.desired ?? {},
  }));
}

/** Every board's online state and report (moved on to now), by board id. */
export async function allBoardStates(): Promise<Map<string, BoardState>> {
  const result = new Map<string, BoardState>();
  const { data, error } = await supabase.from(BOARD_TABLE).select("*");
  if (error) return result;
  for (const row of (data as BoardRow[] | null) ?? []) {
    result.set(row.board_id, { online: isOnline(row), pending: isPending(row), report: reportNow(row), lastSeen: row.last_seen });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Timer commands                                                      */
/* ------------------------------------------------------------------ */
// Timers go to the board as numbered commands in its row. The board runs
// each once and lists the result in reported.acks: {seq, ok, id?, error?}.

export type BoardCommand =
  | { op: "timer"; relay: number; action: "on" | "off"; seconds: number; repeat: boolean }
  | { op: "cancel"; id: number }
  | { op: "cancel_relay"; relay: number };

export interface BoardAck {
  seq: number;
  ok: boolean;
  /** Timer id (op "timer") or how many were cancelled (op "cancel_relay"). */
  id?: number;
  error?: string;
}

/** Queues a command; returns its number, or null if there's no such board. */
export async function pushBoardCommand(boardId: string, command: BoardCommand): Promise<number | null> {
  const { data, error } = await supabase.rpc("board_push_command", { p_board: boardId, p_command: command });
  if (isMissingTable(error) || error?.code === "PGRST202") throw new BoardSetupError(BOARD_SETUP_MESSAGE);
  if (error) throw new Error(error.message);
  readCache.delete(boardId);
  return typeof data === "number" ? data : data == null ? null : Number(data);
}

/**
 * Waits for the board to confirm a command (it reports within a few
 * seconds). Returns the ack and the board's state, or a null ack on timeout.
 */
export async function waitForBoardAck(
  boardId: string,
  seq: number,
  timeoutMs = 10_000
): Promise<{ ack: BoardAck | null; state: BoardState | null }> {
  const until = Date.now() + timeoutMs;
  let state: BoardState | null = null;
  for (;;) {
    readCache.delete(boardId);
    state = await getBoardState(boardId);
    const acks = Array.isArray(state?.report?.acks) ? (state!.report!.acks as unknown[]) : [];
    const ack = acks.find((a) => (a as BoardAck)?.seq === seq) as BoardAck | undefined;
    if (ack) return { ack, state };
    if (Date.now() >= until) return { ack: null, state };
    await new Promise((r) => setTimeout(r, 600));
  }
}
