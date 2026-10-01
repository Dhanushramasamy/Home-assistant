# 02 · Timeline

Everything done on the project, in order. The hardware story comes from the original ChatGPT conversation (summarised in [esp32-history.md](esp32-history.md)); the app story comes from the git history and the Claude Code sessions.

---

## Phase 1 — Hardware prototype (ChatGPT)

1. **Goal:** control the bedroom light and fan over the internet with a Raspberry Pi 4.
2. **Relay module chosen:** 2-channel 5 V relay. Worked through VCC vs JD-VCC, the jumper, and NO/COM wiring for a light switch. Powered the relay from the Pi's 5 V pin.
3. **First relay click** from a Pi 5 GPIO command; verified with a multimeter.
4. **Switched to an ESP32.** Uploaded sketches with Arduino IDE 1.8.19 running on the Pi (board "ESP32 Dev Module"). First test on relay 2, then relay 1.
5. **Remote access:** phone → internet → Pi (**Tailscale**) → LAN → ESP32. It worked, but only on devices with Tailscale installed. Public static IP / port-forwarding was discussed and ruled out for now (CGNAT).
6. **Fixed IP addresses** on the Airtel office network: Pi 5 `.100`, Pi 4 `.101`, ESP32 `.200`. The Pixel hotspot was also set up, at `10.196.10.x` with gateway `.202`.
7. **Wi-Fi priorities** on the ESP32: Pixel hotspot → home Wi-Fi → Airtel office.
8. **Side experiment:** HC-SR04 ultrasonic sensor on the ESP32 (distance reading worked).
9. **Two devices:** ESP200 for the home bedroom (2 relays), ESP201 for the Erode bedroom (fixed `.201`).

## Phase 2 — First version of the app (2026-09-24)

| Commit | What |
|---|---|
| `48092f5`, `e3effc0` | Next.js project created |
| `58881aa` | Fixed a Vercel build error |
| `a188c48` | Browser calls the ESP32 directly on the local network (client-side fetch) |
| `0eaa093`, `fced420` | Mobile-responsive layout; minimal tabbed dashboard |
| `9a6beae` | Supabase tables `user_PRB_home_assistant` and `device_PRB_home_assistant` |
| `7d594da` … `b120909` | Admin login, simple "parent" user view, login required before the dashboard |
| `8ea4a31`, `0655d67` | Device storage state; app icon |

## Phase 3 — Design iterations (2026-09-25)

| Commit | What |
|---|---|
| `134c731` | Large ON/OFF toggle with a compact device label |
| `80c917f` | 3D interactive device controls (React Three Fiber lamp and fan) |
| `bdfb1ba`, `813b388` | Layout, grid and typography clean-up; less text |

Within the Claude Code session, the look went through several directions before the current one:

1. **"Onyx & Champagne"**: dark with gold accents and lots of motion. Rejected: too much text, wrong colours, too many notifications.
2. **Apple-style light**: iOS Home-app tiles, iOS switches, minimal motion and toasts only on errors. Accepted, then "more animation" was added: collapsing title, rolling numbers, icon pop, stretching switch knob.
3. **"Aurora"**: light base with an indigo/violet/pink moving gradient and glass tiles.
4. **"Charcoal glass"** (current), matching a reference design: dark smoked glass, one lime-yellow accent, round glass buttons, On/Off pill toggles, "Hi Dhanush! Welcome Home", floating bottom nav, and the owner's landscape photo as a slowly zooming background.

`13b0c4b` — the charcoal-glass redesign with motion and photo background was committed.

## Phase 4 — Timers, feedback and navigation (2026-09-25)

| Commit | What |
|---|---|
| `d9c946b` | Timers that run on the ESP32 (`/timer`, `/timer/cancel`, `/status`); click sound + haptics on the power switch; Android back gesture closes sheets instead of leaving the app; custom duration, "at a clock time" and custom repeat interval |
| `84dfd31` | Multi-timer support: up to 10 timers per ESP32, each with its own id; new timer-records table |
| `3a8bafa` | Timers saved to the database so every phone sees them (fixed the timer table being checked only once, and adopted timers the ESP32 reports that the DB didn't know) |

## Phase 5 — Two relays, users and security (2026-09-26)

| Commit | What |
|---|---|
| `db810d5` | ESP200's two relays: `/on?relay=N`, each tile reads its own relay from `/status` `relays[]`, offline shows "—" instead of a guess, Wi-Fi SSID / RSSI / uptime on the device screen |
| — | Cleaned up duplicate tiles: ESP200 is now exactly "Light" (relay 1) and "Fan" (relay 2) |
| `295685c` | Create User fixed (the users table had no `role` column) |
| `3f4e466` | **Security overhaul**: server-side login, scrypt-hashed passwords, signed httpOnly session cookie, `proxy.ts` protecting every API route, admin-only actions, Change Password, row-level security SQL |
| `28eb0fd` | **Live sync** between phones (re-read every 3 s and on focus); **per-user device access** (Settings → Users); softer switch sound; iOS 18 haptics |

## Phase 6 — Reliability fixes (2026-09-27)

| Commit | What |
|---|---|
| `2edde3a` | Save button on the Users screen with read-back confirmation; no more "saved" when only a temporary file was written; clearer two-stage click sound |
| `f69e086` | Timers made safe with the ESP200's current firmware: detect `timerApi`, show running timers, cancel per relay, refuse to create timers on old firmware, never call `/timers/clear` |

## Phase 7 — One place for everything (2026-09-28 → 30)

1. `docs/esp32-timer-firmware.md`: the full Timer API v2 specification.
2. Diagnosed the phone-hotspot problem: Android picks a new random address range each time (`10.196.10.x`, `10.198.10.x`, `10.233.105.x`), so fixed hotspot IPs break.
3. **Imported the ChatGPT conversation** (442 messages) from its share link:
   - The firmware now lives in `firmware/esp200` and `firmware/esp201`; both compile with the Arduino IDE's bundled compiler.
   - Wi-Fi passwords moved to git-ignored `secrets.h` files.
   - Summary in `docs/esp32-history.md`; full transcript kept locally in `docs/private/`.
4. This documentation set.

## Phase 8 — Cloud control, four tables, Boards screen (2026-09-30 → 10-01)

1. **Cloud control through Supabase Realtime:** ESP201 works from any network, with no static IP (`0408a09`).
2. **Database rebuilt as four tables:** `users`, `boards`, `switches`, `access`. Timers go through the cloud; the old tables were dropped (`a9e8237`).
3. **Speed and stability:**
   - the server moved to Sydney, next to the database;
   - ESP201's 15-second re-join loop was fixed;
   - its internet work runs on its own core (`ab2169f`, `5c08339`).
4. **Per-switch loader** that waits for the board to confirm, with clear errors (`9c91b0e`, `20ea876`).
5. **Settings → Boards:** set up an ESP32 in the app and download its code; one common firmware template. ESP201 moved to it (`0f7dab3`).
6. **Admin guide** (illustrated PDF, kept private) and [16 · Admin guide](16-admin-guide.md).

Full detail, with incidents and lessons: [15 · Change log](15-change-log.md).

---

## Mistakes made along the way (and what was fixed)

These are recorded so they aren't repeated:

| When | What happened | Fix |
|---|---|---|
| Relay testing | Screenshot scripts toggled real devices and wrote `data/devices.json` | Later tests used mock ESP32s or database-only changes |
| Live-sync test | Wrote "Light OFF" to the DB while it was really ON | Re-synced from `/status` immediately |
| Timer investigation | `/timers/clear?relay=9` wiped all four ESP200 timers (the firmware ignores `relay`) | Relay 2's timer restored with its original end time; the app now never calls `/timers/clear` |
| Device access | Saving fell back to a temporary file on Vercel and said "saved" | Save now fails clearly without the table; read-back confirmation |
| ESP201 first cloud flash | The imported `secrets.h` had the wrong Airtel password, so the board joined no Wi-Fi | Correct password from the user; the Pi's own sketch is the reference for Wi-Fi values |
| Live test on the Pi | Stopping a serial log reader left ESP201 in upload mode (offline) | Board restarted with an RTS pulse; the guide tells you to press EN/RST |
| Faster confirmation attempt | A kept-open HTTPS connection hung the ESP32's second request | Reverted to one connection per report; the loader waits for confirmation |
