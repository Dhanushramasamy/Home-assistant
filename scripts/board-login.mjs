#!/usr/bin/env node
// Creates (or resets) the Supabase sign-in a cloud ESP32 board uses and links
// it to the board's row, creating the row if needed. Prints the lines for the
// board's firmware secrets.h.
//
//   node scripts/board-login.mjs esp201 "ESP201 · Erode bedroom"
//   node scripts/board-login.mjs esp201 --secrets firmware/esp201/secrets.h
//
// With --secrets the lines are written into that file (replacing old ones)
// instead of printed.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
// .env.local). Run supabase/add_cloud_boards.sql first.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const args = process.argv.slice(2);
const secretsAt = args.indexOf("--secrets");
const secretsPath = secretsAt >= 0 ? args.splice(secretsAt, 2)[1] : null;
const [boardId, name] = args;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}
if (!boardId || !/^[a-z0-9-]+$/.test(boardId)) {
  console.error('Usage: node scripts/board-login.mjs <board-id> ["Board name"]   (id: lower-case letters, digits, dashes)');
  process.exit(1);
}

const TABLE = "esp_board_prb_home_assistant";
const email = `${boardId}@boards.home-control.app`;
const password = randomBytes(24).toString("base64url");
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

async function call(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
  return body;
}

// 1. The board's row.
const rows = await call(`/rest/v1/${TABLE}?board_id=eq.${boardId}&select=board_id,auth_user_id`);
if (rows.length === 0) {
  await call(`/rest/v1/${TABLE}`, { method: "POST", body: JSON.stringify({ board_id: boardId, name: name ?? boardId }) });
}
let userId = rows[0]?.auth_user_id ?? null;

// 2. Its sign-in: reuse the linked user (new password) or create one.
if (userId) {
  await call(`/auth/v1/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ password }) });
} else {
  const created = await call(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { board_id: boardId } }),
  });
  userId = created.id;
}

// 3. Link it.
await call(`/rest/v1/${TABLE}?board_id=eq.${boardId}`, {
  method: "PATCH",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({ auth_user_id: userId, ...(name ? { name } : {}) }),
});

const lines = [
  `const char* SUPABASE_HOST = "${new URL(url).host}";`,
  `const char* SUPABASE_KEY = "${publishableKey ?? "<publishable key>"}";`,
  `const char* BOARD_ID = "${boardId}";`,
  `const char* BOARD_EMAIL = "${email}";`,
  `const char* BOARD_PASSWORD = "${password}";`,
];

console.log(`Board "${boardId}" linked to sign-in ${email}.`);
if (secretsPath) {
  const names = ["SUPABASE_HOST", "SUPABASE_KEY", "BOARD_ID", "BOARD_EMAIL", "BOARD_PASSWORD"];
  const kept = readFileSync(secretsPath, "utf8")
    .split("\n")
    .filter((l) => !names.some((n) => l.includes(`const char* ${n} `)) && l !== "// Cloud (scripts/board-login.mjs)");
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  writeFileSync(secretsPath, [...kept, "", "// Cloud (scripts/board-login.mjs)", ...lines, ""].join("\n"));
  console.log(`Wrote the board's sign-in to ${secretsPath}.`);
} else {
  console.log("\nAdd to the board's firmware secrets.h:\n");
  console.log(lines.join("\n"));
}
