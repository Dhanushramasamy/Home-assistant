# 06 · Database

Supabase (Postgres), project `hcaxoxvkokwklazukpuu`. Only the **server** talks to it, through `lib/supabaseClient.ts`, using the secret `SUPABASE_SERVICE_ROLE_KEY`; the browser never queries Supabase. The ESP32 boards also talk to it, each with its own limited sign-in.

Since 2026-10-01 the app uses **four tables**, one per job, created by [`supabase/four_tables.sql`](../supabase/four_tables.sql).

```
users ──── access ──── switches ──── boards ◄──── ESP32
(who)      (allowed)   (what)        (live status)
```

## `users`: who can sign in

| Column | Notes |
|---|---|
| `id` | uuid primary key |
| `username` | unique, matched without caring about capitals |
| `password` | scrypt hash (`scrypt$16384$salt$hash`), never plain text |
| `role` | `admin` (manages everything, uses every switch) or `user` |
| `created_at` | |

## `boards`: each ESP32 and its live status

| Column | Written by | Notes |
|---|---|---|
| `board_id` | admin | primary key, e.g. `esp201` (lower-case letters, digits, dashes) |
| `name` | admin | e.g. `ESP201 · Erode bedroom` |
| `auth_user_id` | `scripts/board-login.mjs` | the board's own Supabase sign-in |
| `desired` | app (board for local changes) | `{"1":"on"}`: what each relay should be |
| `commands` | app | last 10 timer commands, each `{seq, at, op, ...}` |
| `command_seq` | database | number of the latest command |
| `reported` | board | its `/status` JSON: relays, timers, Wi-Fi, IP, uptime, cloud state, `acks` (command results) |
| `ip`, `ssid`, `rssi` | board | current network, shown in Settings → Network |
| `desired_at`, `reported_at`, `last_seen` | trigger | set by the database's clock |
| `relay_pins`, `relay_active_low` | admin (Settings → Boards) | ESP32 pin per relay; relay type |
| `wifi` | admin | `[{ssid, priority, password}]`, password encrypted by the server |
| `secret` | server | the board's sign-in password, encrypted ([14](14-adding-a-board.md)) |

Details: [13 · Cloud control](13-cloud-control.md).

## `switches`: each light or fan tile

| Column | Notes |
|---|---|
| `id` | text primary key, e.g. `light`, `home-fan-1` |
| `name`, `room` | shown on the tile |
| `type` | `light`, `fan`, `plug` or `other` |
| `board_id` | which board (empty = direct IP only, e.g. ESP200 today) |
| `relay` | relay number on that board (1–16); one switch per board + relay |
| `ip` | the board's IP, for direct control on the same Wi-Fi |
| `created_at` | |

There is no ON/OFF column: cloud switches read it from their board's `reported`, and direct-IP switches from the last `/status` the server read.

## `access`: which user may use which switch

| Column | Notes |
|---|---|
| `user_id` | → `users.id` (deleted with the user) |
| `switch_id` | → `switches.id` (deleted with the switch) |
| `created_at` | |

One row per permission. Admins need no rows.

## Functions

| Function | Who | Does |
|---|---|---|
| `board_set_relay(board, relay, power)` | server only | Changes one relay in `desired` without touching the others |
| `board_push_command(board, command)` | server only | Adds a numbered timer command, keeping the last 10; returns its number |
| `boards_touch()` (trigger) | automatic | Sets `last_seen` / `reported_at` on every board check-in, and `desired_at` |

## Security (row-level security)

- RLS is on for all four tables.
- `users`, `switches` and `access` have no policies, so only the server (service-role key) can read or change them. Without that key on a server, login and devices fail there.
- A board signs in as its own Supabase user. It can read only its own `boards` row, and update only `desired`, `reported`, `ip`, `ssid`, `rssi` and `last_seen`. Tested: a board gets "permission denied" on `users`, and 403 when changing its name.
- The two functions can only be run by the service role.

## SQL files

| File | Does | Status |
|---|---|---|
| `supabase/four_tables.sql` | Creates the four tables, functions, security and Realtime; copied the old data | ✅ run 2026-10-01 |
| `supabase/drop_old_tables.sql` | Deletes the tables from before the move | ✅ run 2026-10-01 |
| `supabase/board_setup.sql` | Board setup columns: relays, pins, Wi-Fi, encrypted sign-in | ✅ run 2026-10-01 |

The old tables were `user_PRB_home_assistant`, `user_device_access_PRB_home_assistant`, `device_PRB_home_assistant`, `device_timer_PRB_home_assistant` and `esp_board_prb_home_assistant`. Their SQL files are in git history up to commit `a9e8237`.

## Local files

`data/network.json` holds the network settings (Settings → Network); it isn't in the database yet ([12](12-roadmap-and-known-issues.md)). On Vercel it resets when the server restarts. `data/devices.json` and `data/device-access.json` are no longer used.

## Not ours

The `linear_*` tables (issues, comments, projects, labels, milestones) in the same Supabase project belong to a separate Linear sync. The app never reads them.
