# 06 · Database

The app uses **Supabase** (Postgres). Only the **server** talks to it, through `lib/supabaseClient.ts`, preferring the secret `SUPABASE_SERVICE_ROLE_KEY`. The browser never queries Supabase.

## Tables

### `user_PRB_home_assistant` — accounts

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `username` | text | matched case-insensitively at login |
| `password` | text | scrypt hash `scrypt$16384$<salt>$<hash>` (old plain-text values are converted at login) |
| `role` | text | `admin` / `user`, added by `add_user_role.sql`. Without it, DhanushRaja is treated as admin |
| `created_at` | timestamptz | |

### `device_PRB_home_assistant` — one row per relay tile

| Column | Notes |
|---|---|
| `id` | text primary key, e.g. `kitchen-light`, `home-fan-1` |
| `username` | owner (legacy; access is controlled by the access table) |
| `name`, `room`, `type`, `mode`, `ip`, `relay` | see [03 · Architecture](03-architecture.md#device-model) |
| `power_state`, `connection_state` | last known state (the ESP32's `/status` is the truth) |
| `board_id` | cloud board this relay is on (`esp201`); empty = direct IP only. From `add_cloud_boards.sql` |
| `updated_at` | |
| `timer_action`, `timer_seconds`, `timer_repeat`, `timer_started_at` | **legacy** single-timer columns from `add_device_timer.sql`; copied into the timer table as history and no longer written |

### `device_timer_PRB_home_assistant` — timer records (`add_device_timer_records.sql`)

| Column | Notes |
|---|---|
| `id` | uuid |
| `device_id` | → device, `on delete cascade` |
| `esp_timer_id` | the id the ESP32 gave the timer |
| `action`, `seconds` (1–86400), `repeat` | what was requested |
| `status` | `scheduled` → `cancelled` (from the app) or `ended` (the ESP32 no longer reports it) |
| `created_at`, `updated_at` | |

**Rule:** a `scheduled` row is *what the user asked for*, not proof the timer is running. When the ESP32 is reachable, `/status` decides: rows it no longer lists become `ended`, and running timers the DB didn't know are added. Timers are never re-created on the ESP32 from the DB.

### `user_device_access_PRB_home_assistant` — who can use which device (`add_device_access.sql`)

| Column | Notes |
|---|---|
| `username` | lower-case |
| `device_id` | → device, `on delete cascade` |
| `created_at` | |
| primary key | `(username, device_id)` |

Admins aren't listed: they always have every device.

### `esp_board_prb_home_assistant` — cloud boards (`add_cloud_boards.sql`)

One row per ESP32 in cloud mode: `desired` (what the app wants), `reported` (the board's `/status`), `ip`, `ssid`, `rssi` and `last_seen`. Each board signs in as its own Supabase user and can read and update only its own row. Full details in [13 · Cloud control](13-cloud-control.md#database).

## SQL files (`supabase/`) and order

Run each once in the Supabase SQL editor. All are additive and safe to re-run.

| # | File | Does | Status |
|---|---|---|---|
| 1 | `add_user_role.sql` | Adds `role` to users; DhanushRaja = admin | run it if Create User can't make admins |
| 2 | `add_device_timer.sql` | Legacy single-timer columns | superseded by #3 |
| 3 | `add_device_timer_records.sql` | Creates the timer-records table; copies legacy timers as `ended` | ✅ run |
| 4 | `add_device_access.sql` | Creates the per-user access table (RLS on) | ✅ run |
| 5 | `lock_down_tables.sql` | Enables row-level security on users, devices and timers; drops public policies | ✅ run (**only after** `SUPABASE_SERVICE_ROLE_KEY` is set everywhere) |
| 6 | `add_cloud_boards.sql` | Cloud boards table, `devices.board_id`, `set_board_relay()`, board-only RLS, Realtime | ✅ run 2026-09-30 ([13](13-cloud-control.md#database)) |

## Row-level security

- RLS is **on** with **no policies**, so the public (publishable/anon) key reads nothing. We checked: it returns an empty result.
- The server uses the **service-role key**, which bypasses RLS.
- If the service-role key is missing on a server, that server can't read users or devices (login fails with "Invalid username or password").

## Local fallbacks (development)

| File | Used when |
|---|---|
| `data/devices.json` | Supabase is unreachable (also mirrors the last device list) |
| `data/network.json` | **Always:** network settings are stored only here (see known issues) |
| `data/device-access.json` | The access table is missing, in development only. Git-ignored |

On Vercel these files live in the server's temporary folder and are lost on restart. That's why the access table must exist in production, and why saving access **fails clearly** there instead of pretending.
