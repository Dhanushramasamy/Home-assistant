# 14 · Adding a board (ESP32)

Every ESP32 runs the same firmware, the **common template** in [`firmware/template`](../firmware/template). What differs per board (its name, relays and pins, Wi-Fi networks, cloud sign-in) is set in the app and downloaded as a ready Arduino folder. No terminal and no static IP are needed.

## Steps

### 1. In the app: Settings → Boards → Add board (admin only)

| Field | What to enter |
|---|---|
| Name | Short id, lower-case letters, digits, dashes, e.g. `esp202`. Can't be changed later |
| Label | Friendly name, e.g. `Hall` |
| Number of relays | 1–8 |
| Relay N pin | Filled with the usual pins (23, 22, 21, 19, …). Change only if wired differently. Only safe pins are offered |
| Relay turns on when pin is | `LOW` for most relay modules |
| Wi-Fi networks | Name and password for each network, as many as needed. **Priority 1 is tried first**; use ↑ ↓ to reorder |

Tap **Add board**. The app saves the board in the `boards` table, encrypts the Wi-Fi passwords, and creates the board's own sign-in.

### 2. Download the code

Tap **Download code** to get `esp202.zip` with:

| File | What |
|---|---|
| `esp202.ino` | The common template |
| `cloud.h` | Cloud control |
| `board_config.h` | This board's settings, Wi-Fi passwords and sign-in. **Keep private** |
| `README.txt` | These steps |

### 3. Upload with Arduino IDE (on any computer)

1. Unzip, then File → Open → `esp202/esp202.ino`.
2. First time only:
   - Boards Manager → install **esp32** (Espressif);
   - Library Manager → install **WebSockets** (Markus Sattler) and **ArduinoJson** (Benoit Blanchon).
3. Tools → Board → **ESP32 Dev Module**; Tools → Port → the ESP32.
4. Click **Upload**.

### 4. Back in the app

1. Settings → Boards shows the board **online** within a minute, with its Wi-Fi, IP and last check-in.
2. Tap **+** for each relay: name, room, type, **Board** = `esp202`, relay number. The IP can stay empty.
3. Settings → Users → switch them on for whoever should use them → **Save**.

## An existing ESP32

Same steps. Add it as a board (for ESP200, use the name `esp200`), upload the downloaded code instead of its old sketch, then set **Board** on its existing switches.

ESP201 moved to the template this way on 2026-10-01. Its old sketch in `firmware/esp201` is kept only for reference.

## Changing a board later

- **Wi-Fi, relays or pins:** edit the board, tap **Download code** (it saves first), upload again.
- **Saved passwords:** show as "Saved — type to change". Leave a field empty to keep the saved password.
- **Same sign-in:** the board keeps its sign-in every time you download, so a board that's already running isn't logged out.
- **Delete board:** removes it and its sign-in. Its switches stay in the app with no board.

## How the template behaves

- **Wi-Fi:** scans, then joins the highest-priority network in range. Networks not seen in the scan (hidden ones) are tried last. If Wi-Fi drops for 10 s, it starts again from priority 1. Addresses come from the Wi-Fi (DHCP).
- **Relays:** each restores its last state after a power cut.
- **App control:** cloud control from any network ([13](13-cloud-control.md)).
- **Local control:** the HTTP API on the same Wi-Fi (`/status`, `/on`, `/off`, `/toggle`, `/timer…`), compatible with the app.
- **Timers:** up to 10, kept by the board and **saved in flash with their real end time**. After a power cut or restart:
  - a timer still to come is put back;
  - one missed by up to 10 min runs its action at once;
  - an older one-shot timer is dropped;
  - repeating timers keep their rhythm.
- **Restart reason:** `/status` reports why it last restarted (`reset`: power on, power dip, crash, watchdog, reset button), a start counter (`boots`) and `timersAfterRestart`. Settings → Boards shows it.

## Where things are stored

| What | Where |
|---|---|
| Board, label, relays, pins, relay type | `boards` row (`name`, `relay_pins`, `relay_active_low`) |
| Wi-Fi networks | `boards.wifi`: `[{ssid, priority, password}]`, password encrypted |
| Board sign-in password | `boards.secret`, encrypted; the user is in Supabase Authentication |
| Encryption key | Derived from `BOARD_SECRET_KEY`, or `SESSION_SECRET` if that isn't set (AES-256-GCM, `lib/secretBox.ts`) |

If the key changes, saved passwords can't be read: re-enter the Wi-Fi passwords and download the code again (the board's sign-in is renewed automatically).

## Code

| File | Does |
|---|---|
| `components/settings/BoardsSettings.tsx` | The Boards screen |
| `app/api/boards/[id]` | `PUT` save / create, `DELETE` |
| `app/api/boards/[id]/code` | `GET` the zip (never cached) |
| `lib/boardSetup.ts` | Checks input, encrypts, creates the sign-in, builds `board_config.h` and the zip |
| `supabase/board_setup.sql` | Adds the columns (run 2026-10-01) |
| `next.config.ts` | Bundles `firmware/template` with the download route on Vercel |
