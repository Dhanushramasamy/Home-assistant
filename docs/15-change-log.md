# 15 · Change log (30 Sep – 1 Oct 2026)

Everything done in these two days, in order, with what was decided, what went wrong and how it was fixed. Earlier history is in [02 · Timeline](02-timeline.md).

## 30 September 2026

### Pi 5 checked as a flashing station

| Check | Result |
|---|---|
| SSH | `Dhanush-Ramasamy@192.168.1.100`, key login (no password) |
| System | Debian 12 aarch64, 8 GB RAM, **1.2 GB disk free (98 % full)** |
| Arduino | IDE 1.8.19 (`/usr/local/bin/arduino`, headless `--verify` / `--upload` work), ESP32 core 3.3.12, esptool 5.3.1 |
| ESP32 on USB | `/dev/ttyUSB0` (CH340), the user is in the `dialout` group |
| Compile | The ESP200 sketch compiles on the Pi in about 1.5 min |

The Pi's own sketches (`~/Arduino/relayinnetworkfor200esp`, `…201esp`) matched `firmware/` apart from Wi-Fi lines. They also held the real Pixel hotspot name, which was copied into `firmware/esp201/secrets.h` (git-ignored).

### Decisions about remote access

- The phone hotspot changes its address range each time, so fixed hotspot IPs break.
- A public static IP (Airtel, ₹3,000 a year) plus port forwarding was discussed and **not chosen**: it needs router setup, CGNAT may block it, and it exposes unauthenticated ESP32s to the internet.
- Firebase (from a YouTube tutorial) was studied: the ESP32 *polls* there, and a stream ("ask once, then wait") is better. **Supabase Realtime** does the same and the app already uses Supabase, so it was chosen.
- Capacity: 5 boards + 5 phones is far below the free plan (200 connections, 2 M messages a month).

### Cloud control built (commit `0408a09`)

- **Database:** `supabase/add_cloud_boards.sql` added a boards table, `board_id` on devices, `set_board_relay()`, per-board RLS and Realtime.
- **App:** cloud paths for control, status and test; board state in the device list; a Board field in the device forms; a Cloud Boards list; the daily keep-alive cron (`vercel.json`, needs `CRON_SECRET`).
- **ESP201 firmware:** `cloud.h` (sign-in, Realtime, reports, power-cut restore); the Pixel hotspot moved to DHCP.
- **`scripts/board-login.mjs`:** creates each board's own Supabase login.
- **Tested from the Mac acting as the board:**
  - sign-in OK;
  - reading its own row OK;
  - reading the devices table returned nothing;
  - changing its name was refused (403);
  - a change reached Realtime in 0.6 s.
- **Flashing ESP201 from the Pi:**
  - the first upload failed because the Pi's Arduino IDE Serial Monitor held the port; the user closed it;
  - after flashing, the Pi rebooted by itself once (cause unknown);
  - ESP201 then joined no Wi-Fi: the Airtel password in the imported `secrets.h` was wrong. The user gave the correct one (`Airtel_kaly_5220`) and it connected.
- **Result:** cloud ON and OFF worked; the relay switched in about 1 s.

## 1 October 2026

### Database reworked into four tables (`a9e8237`, `29e7edd`)

- **The four tables:** `users`, `boards`, `switches` and `access`, from `supabase/four_tables.sql`. Your data was copied across: 3 users, 3 switches, 4 access rows and 1 board.
- **No stored ON/OFF state:** switches don't store power; cloud switches read it from their board's report.
- **Timers through the cloud:** `boards.commands` with numbered commands, results in `reported.acks`, and `board_push_command()`. Tested: create, cancel and clear each took 4–6 s.
- **ESP201 firmware:** moved to the `boards` table. It runs each command once (sequence number saved in flash) and ignores commands older than 5 minutes.
- **Old tables:** the user ran `supabase/drop_old_tables.sql`. The old SQL files were removed from the repo (they're still in git history).
- **Removed from the app:** the unused per-device Direct/Gateway picker.

### "Slow and buggy" switching investigated and fixed (`ab2169f`, `5c08339`)

| Found | Fix |
|---|---|
| The Supabase database is in **Sydney** (AWS ap-southeast-2), but the app's server ran in **Washington** (iad1), so every query crossed the Pacific | `vercel.json` `regions: ["syd1"]`. Calls went from 0.7–1.9 s to about 0.55 s |
| Several database reads per tap | One shared switch-list read per request; status no longer writes |
| ESP200 power lived only in server memory, and Vercel runs several copies of the server, so tiles flickered | Unreachable taps now report failure and the tile goes back; home-network devices on the live site are marked unreachable immediately (no 5 s wait) |
| ESP201 **re-joined Realtime every 15 s**: re-joining makes Supabase close the old copy of the channel (`phx_close` with the old ref), which the board took as its own channel closing. Taps in the gaps were lost | Ignore `phx_close` / `phx_error` from older joins |
| A slow TLS handshake (ESP32 default **120 s**) froze the board's web server, timers and relays | All internet work moved to a FreeRTOS task on core 0; HTTPS handshake timeout set to 10 s |

Measured afterwards on the live site: the relay switches about 1.3 s after a tap.

### Per-switch loader (`9c91b0e`, `9bccf29`, `20ea876`)

- **Each switch on its own:** each switch has a lock and a spinner. While it spins, more taps are ignored and background refreshes can't change it.
- **First try:** the loader stopped once the tap was saved. The user found that felt sloppy, so it was reverted.
- **Final:** the loader stays until the **board itself confirms** (2–3 s). Errors:
  - board offline → immediate error;
  - no answer in 10 s → error;
  - the board reports another state → the switch shows the real state, with an error.
- **Tried and dropped:** keeping one HTTPS connection open on the ESP32, to confirm faster. The second request on the kept connection hangs inside the ESP32 TLS library, so the firmware keeps one connection per report.

### Settings → Boards (`0f7dab3`, `0766323`, `4825a40`)

- **Admin screen:** add or edit a board (name, label, relays and pins, relay type, Wi-Fi networks in priority order), save it, and **download its code** as a zip.
- **Stored safely:** Wi-Fi passwords and the board's login password are encrypted (AES-256-GCM, `lib/secretBox.ts`).
- **One common firmware template** (`firmware/template`), with a generated `board_config.h`. No static IP; Wi-Fi by priority, using DHCP.
- **Database:** `supabase/board_setup.sql` added `relay_pins`, `relay_active_low`, `wifi` and `secret` to `boards`.
- **ESP201 moved to the template:**
  - its 3 Wi-Fi networks and existing login were saved into the new columns;
  - its code was downloaded from the live app and flashed through the Pi;
  - it now gets **192.168.1.131** from Airtel by DHCP.
- **Live test:**
  - ON and OFF: the relay switches in 1.1 s, confirmed in 3.3 s;
  - timer add, cancel and clear: about 3 s each.
- **Fixes along the way:**
  - cloud switches now show the IP the board reports;
  - the device form hides the IP row when a Board is set, and the server accepts a switch with a board and no IP.

### Incidents with the Pi and ESP201

| What happened | Cause | Lesson |
|---|---|---|
| ESP201 restarted when a log reader opened its USB port | This board's auto-reset circuit resets on port open | Opening the serial port restarts it; expected |
| ESP201 went **offline** after the log reader was stopped | Closing the port left the board in upload (download) mode | Press **EN/RST** once, or open the port with RTS pulsed (done from the Pi) |
| One unexplained restart during a test | Unknown, possibly the same port-close effect | A logger ran about 2 h afterwards with no unexpected restart |
| `pkill -f esplog.py` over SSH killed the SSH command itself | The pattern matched the command line | Match the process precisely, e.g. `ps … | grep "[p]ython3 /home/…"` |
| Pi upload failed with macOS `._` files | macOS `tar` adds AppleDouble files | Use `COPYFILE_DISABLE=1 tar …` |

### Admin guide PDF

- **What:** "Add a new ESP32 board, step by step", 10 pages, using real screenshots of the live app with numbered markers, a wiring diagram, and the Arduino IDE 1.8.19 steps on the Pi.
- **Where:** `~/Downloads/Add-a-new-ESP32-board.pdf` and `docs/private/guide/` (git-ignored, because it shows usernames, Wi-Fi names and IPs). See [16 · Admin guide](16-admin-guide.md).
- **How the screenshots were taken:** headless Chrome on the live site. Fields were only typed in, never saved.

## 3 October 2026: ESP200 moved to the cloud

Done at home with the Mac and the Pi 5 on home Wi-Fi.

- **Addresses at home:** Mac `192.168.1.10`; the Pi is at **`192.168.1.12`** (found by scanning for SSH; its office address `.100` doesn't apply at home).
- **Before:** ESP200 answered at `192.168.1.200` with both relays OFF and no timers, so nothing was lost by reflashing.
- **Wi-Fi password:** ESP200's home password (from its old sketch on the Pi) matched the one already saved, so it was reused.
- **Board `esp200` created** (same steps as the Boards screen):
  - label "ESP200 · Home bedroom";
  - 2 relays on GPIO 23 (Light) and GPIO 22 (Fan), switching on LOW;
  - Wi-Fi: 1. `Dhanush-Wifi-2.4G`, 2. `Dhanush's Pixel`, 3. `Airtel_kaly_5220`;
  - its own cloud login.
- **Flashed:** code downloaded from the live app and flashed through the Pi (chip ESP32-D0WD, MAC `b8:d6:1a:14:5c:04`).
- **Online:** it came online on home Wi-Fi at **`192.168.1.13`** (address from the router).
- **Switches linked:** the existing Light (relay 1) and Fan (relay 2) switches now use board `esp200`, with no IP.
- **Live-site test:**
  - Light: relay switched in 1.3 s, confirmed in 4.1 s;
  - Fan: relay switched in 1.0 s, confirmed in 3.7 s;
  - a Fan timer added and cancelled in about 3 s each;
  - both are OFF again.
- **ESP201** shows offline while it's not powered (it was on the Pi's USB at the office).
- **Pi addresses:** the Pi's fixed `.100` was set only on the Airtel Wi-Fi profile; at home it got `.12` by DHCP.
  - The home profile `Dhanush-Wifi-5g` now uses a fixed `192.168.1.100` (gateway `192.168.1.1`, DNS from the ISP + 8.8.8.8). `.100` was checked to be free first.
  - The Pixel hotspot profile was changed from a fixed `10.196.10.100` (which breaks when the hotspot changes range) to automatic.
  - Checked afterwards: SSH, internet and DNS work at `.100`.
  - If the home router ever hands `.100` to another device, reserve it for the Pi in the router.

## 3 October 2026: timer review

**Report:** "the timer isn't working".

**Checked end to end:**
- through the server: create, run and cancel;
- through the real app screen, in a headless browser on the live site: set "Turn ON after 10 s" → countdown → the Light turned ON.

Both worked. A first test also showed the Light was already ON, which hid the effect of an ON timer.

**Real gaps found:**
- **Timers lived only in the ESP32's memory,** so any restart deleted them.
- **No record of why a board restarted.**
- **A new timer's countdown flashed a wrong number** (e.g. 00:26) for a second, because the 1-second clock was stale while idle.
- **The browser kept calling an offline cloud board's local address,** which an HTTPS page can't reach anyway.

**Fixed** (`c0c74e4`; template firmware flashed to ESP200 through the Pi):
- **Saved timers:** each timer is saved in flash with its real end time (internet clock). After a restart:
  - a timer still to come is put back with the right time left;
  - one missed by up to 10 min runs its action at once;
  - an older one-shot timer is dropped;
  - repeating timers keep their rhythm.
- **Restart reason:** `/status` and Settings → Boards show the last restart reason (power on, power dip, crash, watchdog, reset button), when it was, a start counter, and timers back / run late / dropped.
- **Countdown:** catches up at once; a clock older than the sync counts as no time passed.
- **Cloud switches:** never call the board's local address from the browser.

**Tested on ESP200:**
- Two Light timers (ON after 240 s, OFF after 255 s), then the board was restarted. Both came back with the right time left ("2 back") and fired on time; the Light ended OFF.
- When a restart kept the board offline past the due time, the timers ran late in order ("2 run late"), also ending OFF.

**USB and power findings:**
- The Pi restarted by itself (that power-cycles the ESP32, and explains a "mystery" restart).
- The Pi's USB link to the ESP32 dropped whenever the ESP32 restarted while on the Pi; the user re-plugged it once.
- **Likely cause:** the ESP32 and the relay module draw too much from the Pi's USB during start-up.
- **Advice:** give the relay module, or the ESP32 when installed, its own 5V supply, and use the official Pi 5 power supply.

**ESP201** still runs the earlier template. It gets saved timers after its next upload (Settings → Boards → Download code → upload).

## State at the end of 1 October

| Item | State |
|---|---|
| ESP201 | Template firmware, cloud online, `192.168.1.131` on Airtel, relay OFF |
| ESP200 | Old direct-IP sketch, home Wi-Fi only; not on the cloud yet (needs one USB upload at home) |
| Database | `users`, `boards`, `switches`, `access` (+ unrelated `linear_*` tables) |
| Live app | `prp-home-assistant.vercel.app`, functions in `syd1` |
| Pi 5 | No logger running; `~/Arduino/libraries` has WebSockets + ArduinoJson; `~/Arduino/boards/esp201` holds ESP201's downloaded code |
| To do by the user | Add `CRON_SECRET` in Vercel; change the Pi password (it was shared in chat); ~~move ESP200 to the cloud~~ (done 3 Oct) |
