# 13 · Cloud control (Supabase)

Cloud control lets the app switch a relay from any network (home Wi-Fi, office, phone hotspot or mobile data, including the Vercel site) with no static IP, no router settings and nothing open to the internet.

Live since 2026-09-30 on **ESP201**. ESP200 still uses direct IP.

## The idea

The app never reaches the ESP32. Both talk to Supabase.

```text
 phone (any network)                Supabase                     ESP32 (any Wi-Fi)
 ───────────────────                ────────                     ─────────────────
 tap ON ──► app server ──► set_board_relay()                     keeps ONE connection open
                            row.desired = {"1":"on"} ──live──►   (Realtime, "tell me when
                                                                  my row changes")
                                                                  switches relay 1 ON
                            row.reported = /status  ◄──HTTPS──   reports back (1–4 s)
 every phone sees ON  ◄──── /api/devices reads reported
```

- The ESP32 opens the connection from inside the network, so the router lets the replies back in, the same way WhatsApp works.
- Supabase sends a change down that open connection about 0.6 s after it's saved (measured).
- Measured on the live site (2026-10-01): the server answers a tap in about 0.6 s, the relay switches about 1.3 s after the tap, and every phone shows it about 1.2 s after.
- The board's own report confirms 2–3 s after a tap, because each report opens a new TLS connection (about 2 s on the ESP32). Reusing one kept-open HTTPS connection was tried and hangs on the second request inside the ESP32 TLS library, so the firmware keeps one connection per report.
- The app's loader stays until the board reports the new state (about 2–3 s). If the board is offline, reports a different state, or doesn't answer within 10 s, the switch shows the real state and an error explains what happened.
- The app's server runs in Sydney (`vercel.json` → `regions: ["syd1"]`), next to the Supabase database (AWS ap-southeast-2). In Washington every query crossed the Pacific, which made each tap take several seconds.

## Database

The `boards` table ([06](06-database.md), created by `supabase/four_tables.sql`) has one row per board:

| Column | Written by | Meaning |
|---|---|---|
| `board_id` | admin | e.g. `esp201` |
| `name` | admin | e.g. `ESP201 · Erode bedroom` |
| `auth_user_id` | `scripts/board-login.mjs` | The board's own Supabase sign-in |
| `desired` | app (and board, for local changes) | `{"1":"on","2":"off"}`: what the relays should be |
| `desired_at` | trigger | When `desired` last changed |
| `commands`, `command_seq` | app | Timer commands, numbered; the last 10 are kept |
| `reported` | board | The board's `/status` JSON: relays, timers, IP, Wi-Fi, uptime, cloud state, `acks` |
| `reported_at` | trigger | When `reported` last changed |
| `ip`, `ssid`, `rssi` | board | Current network, shown in Settings → Network |
| `last_seen` | trigger | Every check-in (every 60 s). Online = seen in the last 150 s |

The SQL also:
- links each switch to a board with `switches.board_id` + `relay`;
- creates `board_set_relay(board, relay, power)`, which changes one relay without overwriting the others (server only);
- creates `board_push_command(board, command)` for timers (server only);
- adds `boards` to the `supabase_realtime` publication;
- adds the `boards_touch` trigger, so the database's clock (not the board's) sets `last_seen`.

### Timers through the cloud

1. **App:** `board_push_command` adds e.g. `{"seq":7,"at":…,"op":"timer","relay":1,"action":"off","seconds":1800,"repeat":false}` to `commands`. Other ops are `cancel` (`id`) and `cancel_relay` (`relay`).
2. **Board:** it hears the change instantly and runs every command newer than the last one it ran. That number is saved in flash, so a restart never repeats a command, and commands older than 5 minutes are ignored.
3. **Board:** it reports the result in `reported.acks`, e.g. `{"seq":7,"ok":true,"id":3}`, or `{"ok":false,"error":"limit"}`.
4. **App:** it waits up to 10 s for the ack (normally 4–6 s), then shows the timer. It refuses to queue timers for an offline board.

### Security

- Each board signs in as its own Supabase Auth user (`<board>@boards.home-control.app`, random 32-character password).
- Row-level security lets a board **read and update only its own row**, and only the columns `desired`, `reported`, `ip`, `ssid`, `rssi`, `last_seen`. Tested: a board sees nothing in the devices table, and changing its `name` returns 403.
- The service-role key stays on the server; it is never on a board.
- Traffic is HTTPS and WSS. The board checks Supabase's certificate against four bundled root certificates (GTS Root R1/R4, ISRG Root X1, GlobalSign Root CA); GlobalSign expires in 2028, the others in 2035–2036.
- If a board is stolen, its password only exposes that board's row. Run the script again to change the password.

## The app

| Where | What changed |
|---|---|
| `lib/boardStore.ts` | Reads boards, sets relays (`board_set_relay`), queues timer commands (`board_push_command`) and waits for acks, moves timer countdowns on by the report's age, counts an unconfirmed tap for 15 s |
| `lib/deviceController.ts` | Devices with a `boardId` switch through the board (`controlViaBoard`), read status from the board's report (`boardStatus`) and test by last check-in |
| `app/api/devices` (GET) | Board devices take power and online state from the board, so wall-switch or timer changes show on every phone within 3 s |
| `app/api/boards` | Admin only: every board with network, IP, signal, last check-in |
| Settings → Network | New **Cloud Boards** list (refreshes every 10 s) |
| Add / Edit device | New **Cloud · Board** field. Empty = direct IP as before |
| `app/api/cron/keepalive` + `vercel.json` | Vercel calls it daily at 08:00 IST so the free Supabase project never pauses. Needs `CRON_SECRET` in Vercel |
| `lib/timerParse.ts` | Reads `relayN: true/false` too (ESP201's format, which the app used to miss) |

**Timers** for cloud switches are created, cancelled and shown from anywhere (see *Timers through the cloud* above).

## The firmware

`firmware/esp201/cloud.h` does all the cloud work; the sketch only includes it and calls `cloudBegin()` and `cloudLoop()`.

All internet work runs in its **own task on CPU core 0**, while the sketch's web server, timers and relays run on core 1. A slow or stuck connection (an ESP32 TLS handshake can wait up to the 120 s default) never freezes the board. The two sides only swap small messages under a lock: the cloud task passes on relays to switch and timer commands; the main loop passes back a fresh `/status` to report.

1. **Boot:** restores each relay's last state from flash (power-cut restore), then connects to Wi-Fi and gets the time (NTP).
2. **Sign in:** `POST /auth/v1/token` with the board's email and password, then refreshes the token 5 minutes before its 1-hour expiry.
3. **Listen:** opens `wss://<project>.supabase.co/realtime/v1/websocket` and joins `realtime:board-esp201` for `UPDATE`s on its own row. It sends a heartbeat every 25 s, and reconnects and re-joins by itself. When it re-joins, Supabase closes the previous copy of the channel (`phx_close` with the old join's `ref`); the board ignores that, because treating it as its own channel closing caused an endless re-join every 15 s that missed taps (fixed 2026-10-01).
4. **Catch up:** after joining, and again on "Subscribed to PostgreSQL", it reads `desired` once (`GET /rest/v1/...`), so taps made while it was offline still happen.
5. **Report:** `PATCH`es its row with `/status` after every relay or timer change, and at least every 60 s (the check-in).
6. **Local changes** (direct `/on`, a timer firing, later a wall switch) also update `desired`, so the app doesn't switch the relay back. If a local change happened while offline, it wins over the app on reconnect.

Libraries: **WebSockets** (Markus Sattler) 2.7.2 and **ArduinoJson** 7.4.3. The sketch now uses 90 % of flash.

The Pixel hotspot now uses DHCP, because its range changes each start and a fixed IP would cut the board off the internet. The board's current IP is in Settings → Network.

### Different networks

| Situation | What happens |
|---|---|
| Home, office or hotspot with internet | Full control from anywhere |
| Wi-Fi up, internet down | Cloud control stops; `http://<IP>/on` still works on the same Wi-Fi |
| Wi-Fi drops or router restarts | Reconnects, re-joins, reads `desired`, reports |
| Power cut | Relay comes back in its last state, then follows the app once online |
| Tap while the board is offline | Saved; happens when it's back. The tile shows offline meanwhile |

## Adding a board

```bash
# 1. Create its sign-in and write it into the sketch's secrets.h
node scripts/board-login.mjs esp200 "ESP200 · Home bedroom" --secrets firmware/esp200/secrets.h
# 2. Add cloud.h to the sketch (see esp201.ino: CLOUD_RELAYS, include, setRelay hook,
#    cloudTimerSignature, cloudBegin/cloudLoop, "relays"/"cloud" in /status), flash it
# 3. In the app: Edit each device on that board -> Cloud -> Board = esp200
```

## Checking it

```bash
curl http://192.168.1.201/status        # "cloud":"online" when listening
```

In the app: Settings → Network → Cloud Boards shows the board online with its Wi-Fi and IP. Test Connection on the device says "online through esp201".

## Free-plan numbers

| | Use (5 boards, 5 phones) | Free plan |
|---|---|---|
| Realtime connections | 5 (phones don't use Realtime) | 200 |
| Realtime messages / month | about 220,000 (one per check-in plus taps) | 2,000,000 |
| Database | a few KB | 500 MB |
