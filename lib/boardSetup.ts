import { readFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { BOARD_SAFE_PINS, BoardSetupInput, MAX_BOARD_RELAYS, MAX_BOARD_WIFI } from "@/types";
import { supabase } from "./supabaseClient";
import { open, seal } from "./secretBox";
import { makeZip } from "./zip";

// Server-only. Board setup from Settings → Boards (admin): saves a board's
// relays and Wi-Fi networks, gives it its own Supabase sign-in, and builds
// its firmware (the common template in firmware/template + a generated
// board_config.h). See supabase/board_setup.sql.

const BOARD_TABLE = "boards";
const TEMPLATE_DIR = path.join(process.cwd(), "firmware", "template");

export const BOARD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/;
const emailOf = (boardId: string) => `${boardId}@boards.home-control.app`;

/** A saved network; `password` is sealed (secretBox). */
interface StoredWifi {
  ssid: string;
  priority: number;
  password: string;
}

interface SetupRow {
  board_id: string;
  name: string | null;
  auth_user_id: string | null;
  relay_pins: number[] | null;
  relay_active_low: boolean | null;
  wifi: StoredWifi[] | null;
  secret: string | null;
}

export class BoardSetupProblem extends Error {}

async function readRow(boardId: string): Promise<SetupRow | null> {
  const { data, error } = await supabase
    .from(BOARD_TABLE)
    .select("board_id, name, auth_user_id, relay_pins, relay_active_low, wifi, secret")
    .eq("board_id", boardId)
    .maybeSingle();
  if (error) {
    if (/relay_pins|wifi|secret/.test(error.message)) {
      throw new BoardSetupProblem("Board setup isn't in the database yet. Run supabase/board_setup.sql in Supabase.");
    }
    throw new Error(error.message);
  }
  return (data as SetupRow | null) ?? null;
}

/** What's wrong with the input, or null if it's fine. */
export function checkSetup(boardId: string, input: BoardSetupInput): string | null {
  if (!BOARD_ID_PATTERN.test(boardId)) return "Board name: 2–32 lower-case letters, digits or dashes, e.g. esp202.";
  if (!input.name?.trim() || input.name.trim().length > 40) return "Label: 1–40 characters, e.g. Hall.";

  const pins = input.relayPins ?? [];
  if (pins.length < 1 || pins.length > MAX_BOARD_RELAYS) return `A board has 1–${MAX_BOARD_RELAYS} relays.`;
  if (pins.some((p) => !(BOARD_SAFE_PINS as readonly number[]).includes(p))) return "Pick each relay's pin from the list.";
  if (new Set(pins).size !== pins.length) return "Each relay needs its own pin.";

  const wifi = input.wifi ?? [];
  if (wifi.length < 1 || wifi.length > MAX_BOARD_WIFI) return `Add 1–${MAX_BOARD_WIFI} Wi-Fi networks.`;
  const names = wifi.map((w) => w.ssid?.trim() ?? "");
  if (names.some((n) => n.length < 1 || n.length > 32)) return "Each Wi-Fi name must be 1–32 characters.";
  if (new Set(names).size !== names.length) return "The same Wi-Fi is listed twice.";
  for (const w of wifi) {
    if (w.password === undefined) continue;
    if (w.password.length > 63 || (w.password.length > 0 && w.password.length < 8)) {
      return `Wi-Fi password for "${w.ssid}": 8–63 characters, or empty for an open network.`;
    }
  }
  return null;
}

/** Saves (or creates) a board and makes sure it has its own sign-in. */
export async function saveBoardSetup(boardId: string, input: BoardSetupInput): Promise<{ created: boolean }> {
  const problem = checkSetup(boardId, input);
  if (problem) throw new BoardSetupProblem(problem);

  const existing = await readRow(boardId);
  const previous = existing?.wifi ?? [];

  const wifi: StoredWifi[] = input.wifi.map((w, i) => {
    const ssid = w.ssid.trim();
    if (w.password !== undefined) return { ssid, priority: i + 1, password: seal(w.password) };
    const kept = previous.find((p) => p.ssid === (w.originalSsid ?? ssid));
    if (!kept) throw new BoardSetupProblem(`Enter the password for "${ssid}".`);
    return { ssid, priority: i + 1, password: kept.password };
  });

  const row = {
    board_id: boardId,
    name: input.name.trim(),
    relay_pins: input.relayPins,
    relay_active_low: input.relayActiveLow !== false,
    wifi,
  };

  const { error } = existing
    ? await supabase.from(BOARD_TABLE).update(row).eq("board_id", boardId)
    : await supabase.from(BOARD_TABLE).insert(row);
  if (error) throw new Error(error.message);

  await ensureSignIn(boardId);
  return { created: !existing };
}

async function findAuthUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email === email);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * The board's sign-in password (created on first use). A board keeps the
 * same password, so downloading its code again doesn't log out the board
 * that's already running.
 */
async function ensureSignIn(boardId: string): Promise<string> {
  const row = await readRow(boardId);
  if (!row) throw new BoardSetupProblem(`Board "${boardId}" doesn't exist.`);

  const saved = open(row.secret);
  if (row.auth_user_id && saved) return saved;

  const password = randomBytes(24).toString("base64url");
  let userId = row.auth_user_id;

  if (userId) {
    // Linked earlier (e.g. by scripts/board-login.mjs) but no saved password.
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(error.message);
  } else {
    const email = emailOf(boardId);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { board_id: boardId },
    });
    if (data?.user) {
      userId = data.user.id;
    } else {
      // Left over from a board that was deleted: reuse it.
      userId = await findAuthUserId(email);
      if (!userId) throw new Error(error?.message ?? "Couldn't create the board's sign-in.");
      const update = await supabase.auth.admin.updateUserById(userId, { password });
      if (update.error) throw new Error(update.error.message);
    }
  }

  const { error } = await supabase.from(BOARD_TABLE).update({ auth_user_id: userId, secret: seal(password) }).eq("board_id", boardId);
  if (error) throw new Error(error.message);
  return password;
}

/** Deletes a board and its sign-in. Its switches stay, with no board. */
export async function deleteBoard(boardId: string): Promise<boolean> {
  const row = await readRow(boardId);
  if (!row) return false;
  const { error } = await supabase.from(BOARD_TABLE).delete().eq("board_id", boardId);
  if (error) throw new Error(error.message);
  if (row.auth_user_id) await supabase.auth.admin.deleteUser(row.auth_user_id);
  return true;
}

/** C string literal. */
function cText(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
}

function boardConfig(row: SetupRow, password: string, wifi: { ssid: string; password: string }[]): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcaxoxvkokwklazukpuu.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const pins = row.relay_pins?.length ? row.relay_pins : [23];
  const today = new Date().toISOString().slice(0, 10);

  return `// Generated by Home Control for board "${row.board_id}" on ${today}.
// KEEP PRIVATE: it holds your Wi-Fi passwords and the board's sign-in.
// To change anything, edit the board in the app and download the code again.
#pragma once

const char* BOARD_ID = ${cText(row.board_id)};
const char* BOARD_NAME = ${cText(row.name || row.board_id)};

// Relays: how many, the ESP32 pin for each, and whether the relay module
// switches on when the pin is LOW (most modules do).
#define RELAY_COUNT ${pins.length}
const uint8_t RELAY_PINS[RELAY_COUNT] = {${pins.join(", ")}};
#define RELAY_ACTIVE_LOW ${row.relay_active_low === false ? "false" : "true"}

// Wi-Fi networks, highest priority first.
struct WifiNetwork {
  const char* ssid;
  const char* password;
};
#define WIFI_COUNT ${wifi.length}
const WifiNetwork WIFI_NETWORKS[WIFI_COUNT] = {
${wifi.map((w, i) => `  {${cText(w.ssid)}, ${cText(w.password)}},  // ${i + 1}`).join("\n")}
};

// Cloud sign-in for this board.
const char* SUPABASE_HOST = ${cText(new URL(url).host)};
const char* SUPABASE_KEY = ${cText(key)};
const char* BOARD_EMAIL = ${cText(emailOf(row.board_id))};
const char* BOARD_PASSWORD = ${cText(password)};
`;
}

function readme(boardId: string): string {
  return `Home Control board "${boardId}"
==============================

1. Arduino IDE: File > Open > ${boardId}/${boardId}.ino
2. First time only: Tools > Board > Boards Manager > install "esp32" (Espressif).
   Sketch > Include Library > Manage Libraries > install "WebSockets" (Markus Sattler)
   and "ArduinoJson" (Benoit Blanchon).
3. Tools > Board > esp32 > ESP32 Dev Module. Plug in the ESP32, Tools > Port > its port.
4. Click Upload. When it says "Done uploading" the board restarts and connects.
5. In the app: Settings > Boards shows "${boardId}" online within a minute.
   Then add a switch for each relay (+ button, Board = ${boardId}).

board_config.h has your Wi-Fi passwords. Don't share this folder.
`;
}

/** The board's ready-to-upload Arduino folder, as a zip. */
export async function boardCodeZip(boardId: string): Promise<Buffer> {
  const row = await readRow(boardId);
  if (!row) throw new BoardSetupProblem(`Board "${boardId}" doesn't exist.`);
  if (!row.wifi?.length) throw new BoardSetupProblem("Add at least one Wi-Fi network and save first.");

  const wifi = [...row.wifi]
    .sort((a, b) => a.priority - b.priority)
    .map((w) => {
      const password = open(w.password);
      if (password === null) throw new BoardSetupProblem(`Enter the password for "${w.ssid}" again and save.`);
      return { ssid: w.ssid, password };
    });

  const password = await ensureSignIn(boardId);
  const [sketch, cloud] = await Promise.all([
    readFile(path.join(TEMPLATE_DIR, "board.ino"), "utf8"),
    readFile(path.join(TEMPLATE_DIR, "cloud.h"), "utf8"),
  ]);

  return makeZip({
    [`${boardId}/${boardId}.ino`]: sketch,
    [`${boardId}/cloud.h`]: cloud,
    [`${boardId}/board_config.h`]: boardConfig(row, password, wifi),
    [`${boardId}/README.txt`]: readme(boardId),
  });
}
