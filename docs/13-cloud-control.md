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
- Confirmed state reaches the app 2–4 s after a tap, because each report opens a new HTTPS connection on the ESP32. Until then the app keeps showing what was tapped.

## Database

`supabase/add_cloud_boards.sql` (run once, already run) creates `esp_board_prb_home_assistant`, one row per board:

| Column | Written by | Meaning |
|---|---|---|
| `board_id` | admin | e.g. `esp201` |
| `name` | admin | e.g. `ESP201 · Erode bedroom` |
| `auth_user_id` | `scripts/board-login.mjs` | The board's own Supabase sign-in |
| `desired` | app (and board, for local changes) | `{"1":"on","2":"off"}`: what the relays should be |
| `desired_at` | trigger | When `desired` last changed |
| `reported` | board | The board's `/status` JSON: relays, timers, IP, Wi-Fi, uptime, cloud state |
| `reported_at` | trigger | When `reported` last changed |
| `ip`, `ssid`, `rssi` | board | Current network, shown in Settings → Network |
| `last_seen` | trigger | Every check-in (every 60 s). Online = seen in the last 150 s |

The SQL also:
- adds `board_id` to `device_PRB_home_assistant`, linking one app device (one relay) to a board;
- creates `set_board_relay(board, relay, power)`, which changes one relay without overwriting the others (server only);
- adds the table to the `supabase_realtime` publication;
- adds the `esp_board_touch` trigger, so the database's clock (not the board's) sets `last_seen`.

### Security

- Each board signs in as its own Supabase Auth user (`<board>@boards.home-control.app`, random 32-character password).
- Row-level security lets a board **read and update only its own row**, and only the columns `desired`, `reported`, `ip`, `ssid`, `rssi`, `last_seen`. Tested: a board sees nothing in the devices table, and changing its `name` returns 403.
- The service-role key stays on the server; it is never on a board.
- Traffic is HTTPS and WSS. The board checks Supabase's certificate against four bundled root certificates (GTS Root R1/R4, ISRG Root X1, GlobalSign Root CA); GlobalSign expires in 2028, the others in 2035–2036.
- If a board is stolen, its password only exposes that board's row. Run the script again to change the password.

## The app

| Where | What changed |
|---|---|
| `lib/boardStore.ts` | Reads boards, sets relays (`set_board_relay`), moves timer countdowns on by the report's age, counts an unconfirmed tap for 15 s |
| `lib/deviceController.ts` | Devices with a `boardId` switch through the board (`controlViaBoard`), read status from the board's report (`boardStatus`) and test by last check-in |
| `app/api/devices` (GET) | Board devices take power and online state from the board, so wall-switch or timer changes show on every phone within 3 s |
| `app/api/boards` | Admin only: every board with network, IP, signal, last check-in |
| Settings → Network | New **Cloud Boards** list (refreshes every 10 s) |
| Add / Edit device | New **Cloud · Board** field. Empty = direct IP as before |
| `app/api/cron/keepalive` + `vercel.json` | Vercel calls it daily at 08:00 IST so the free Supabase project never pauses. Needs `CRON_SECRET` in Vercel |
| `lib/timerParse.ts` | Reads `relayN: true/false` too (ESP201's format, which the app used to miss) |

**Timers** for cloud devices are *shown* from anywhere, because they come from the report. *Creating or cancelling* a timer still goes to the board's IP, so it only works on the same network. Cloud timers are the next step ([12](12-roadmap-and-known-issues.md)).

## The firmware

`firmware/esp201/cloud.h` does all the cloud work; the sketch only includes it and calls `cloudBegin()` and `cloudLoop()`.

1. **Boot:** restores each relay's last state from flash (power-cut restore), then connects to Wi-Fi and gets the time (NTP).
2. **Sign in:** `POST /auth/v1/token` with the board's email and password, then refreshes the token 5 minutes before its 1-hour expiry.
3. **Listen:** opens `wss://<project>.supabase.co/realtime/v1/websocket` and joins `realtime:board-esp201` for `UPDATE`s on its own row. It sends a heartbeat every 25 s, and reconnects and re-joins by itself.
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
