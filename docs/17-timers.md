# 17 · Timers: how they work

Timers run **on the ESP32 itself**, so they fire even when every phone is closed or the internet is down. Since 2026-10-03 they also survive a power cut or restart.

## Limits

- **Up to 10 timers per ESP32**, shared across its relays (e.g. Light ON at 18:00, Light OFF at 23:00, Fan OFF after 2 h, Fan ON every 1 h).
- **Length:** 1 second to 24 hours each.
- **Actions:** turn ON or turn OFF (never toggle), once or repeating.
- **Independent:** each timer can be cancelled on its own; "Cancel All Timers" clears one relay.

## Who holds what

| Place | Holds | Used for |
|---|---|---|
| **ESP32 working memory (RAM)** | The running timers | Counting down and firing |
| **ESP32 flash ("timers" in Preferences)** | Every timer with its **fire time** (real clock time) | **The real copy**: brings timers back after a restart |
| **Database: `boards.commands`** | Your "create / cancel" requests, numbered | Carries the request from the app to the board |
| **Database: `boards.reported`** | The board's running timers (time left) and `acks` | Lets the app show countdowns and confirm requests |

**The ESP32's flash is the source of truth.** The database only carries requests to the board and shows the app what's running; it's **never** used to restore timers. So timers keep working even if the internet or the database is down. The internet is needed only for the correct time after a restart.

## Creating a timer

1. **In the app:** device screen → Turn On / Turn Off, After / At time → **Start Timer**.
2. **Server:** `startDeviceTimer` checks the board is online, then calls `board_push_command`, which adds e.g. `{"seq":7,"op":"timer","relay":1,"action":"off","seconds":7200,"repeat":false}` to `boards.commands`.
3. **ESP32:** Supabase Realtime delivers it in under a second. The board:
   - runs each command number once (the last number is saved in flash, and commands older than 5 min are ignored);
   - creates the timer in RAM;
   - **saves the timer list to flash**;
   - reports `acks: [{"seq":7,"ok":true,"id":3}]`.
4. **App:** it waits for that ack (about 3 s), then shows the timer card with its countdown.

## What is saved in flash

**A fire time, not a duration.** "Turn OFF after 2 hours", set at 21:00, is saved as **"turn OFF at 23:00"**: a duration can't be resumed after a restart, because nobody knows when it started. The board gets the real time from the internet (NTP, `pool.ntp.org`) at start-up.

| Field | Example |
|---|---|
| Timer number | 3 |
| Relay | 1 |
| Action | OFF |
| Repeat / every | no, or every 3600 s |
| **Fire time** | 23:00:00 (Unix time) |

The list is rewritten whenever it changes: a timer is added, cancelled, or a one-time timer fires. A repeating timer firing doesn't rewrite it, because its next turn can be worked out from the saved fire time and its period, which also spares the flash.

## After a power cut or restart

1. **Relays first:** the board switches each relay back to its last state.
2. **Clock:** it joins Wi-Fi and gets the current time from the internet.
3. **Saved timers:** it reads them and compares each fire time with now:

| Case | What happens |
|---|---|
| Fire time still in the future | **Put back** with the time that's left (e.g. "fires in 3 min") |
| Passed, by **up to 10 minutes** | **Runs its action now** (e.g. turns the light OFF), in the order they were due |
| Passed by more than 10 minutes, one-time | **Dropped**: switching a light hours late would be wrong |
| Passed, repeating | Carries on with its next turn, in rhythm (and runs now if missed by up to 10 min) |

4. **Saves the cleaned-up list** and reports "timers after restart: N back, N run late, N dropped". Settings → Boards shows it.

**Safety:** until the saved list has been read back (which needs the clock), the board never saves, so an empty list can't overwrite the saved timers. Timer numbers continue from the saved counter, so they stay unique.

## Restart reason

At start-up the board asks the ESP32 chip why it restarted, and reports it as `reset` in its status, with a start counter `boots`:

| Chip reason | Shown as | Usually means |
|---|---|---|
| Power on | power on | Power connected, or the board was unplugged (or the Pi feeding its USB restarted) |
| Brown-out | **power dip** | 5V sagged (relay coils, weak USB / adapter) |
| Panic | **crash** | Firmware error |
| Watchdog | **watchdog (stuck)** | Firmware froze |
| External | reset button | EN/RST pressed, or a reset from the USB port |

Settings → Boards shows "Last restart: power dip · 6 min ago" (worked out from the board's uptime), and the timers after it.

## The countdown on screen

- The board reports each timer's **time left** when it writes its status, and the server moves it on by the report's age.
- The app counts down locally every second from the moment it last synced, and corrects itself at each sync.
- **Fix (2026-10-03):** the one-second clock pauses while no timer is visible. It now catches up at once when a timer appears, and a clock older than the last sync counts as "no time passed". Before, a new 10 s timer flashed "00:26" for a second.

## Tested on ESP200 (2026-10-03)

| Test | Result |
|---|---|
| App screen: "Turn ON after 10 s" | Countdown, then the Light turned ON on time |
| Light timers ON in 240 s and OFF in 255 s, then a restart | **"2 back"**, the right time left; fired on time; the Light ended OFF |
| Restart that left the board offline past the due time | **"2 run late"**, in order; the Light ended OFF |

## Code

| Part | File |
|---|---|
| Saving and restoring timers, restart reason | `firmware/template/board.ino` (SAVED TIMERS, WHY IT LAST RESTARTED) |
| Commands and acks on the board | `firmware/template/cloud.h` |
| Sending commands, waiting for acks | `lib/boardStore.ts` (`pushBoardCommand`, `waitForBoardAck`), `lib/deviceController.ts` (`timerViaBoard`) |
| Restart info for Settings → Boards | `lib/boardStore.ts` (`restartOf`), `components/settings/BoardsSettings.tsx` |
| Countdown | `lib/useNow.ts`, `lib/timerClient.ts` (`remainingNow`) |
| Timer screen | `components/Device3DModal.tsx` |
