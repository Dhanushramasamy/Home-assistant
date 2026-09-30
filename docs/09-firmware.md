# 09 · Firmware

The ESP32 code lives in this repository, next to the app, so both can be changed together.

```text
firmware/
├── README.md                 How to upload; hotspot ".201" snippet
├── esp200/
│   ├── esp200.ino            ESP200: 2 relays, Timer API v2 (from ChatGPT message 427)
│   ├── secrets.h             Wi-Fi name + password (git-ignored)
│   └── secrets.example.h     Template for secrets.h
└── esp201/
    ├── esp201.ino            ESP201: 1 relay, Pixel → Home → Office, Timer API v2, cloud control
    ├── cloud.h               Supabase cloud control (docs/13-cloud-control.md)
    ├── secrets.h             Wi-Fi + the board's cloud sign-in (git-ignored)
    └── secrets.example.h
```

Both sketches compile for **ESP32 Dev Module** (`esp32:esp32:esp32`, core 3.3.11/3.3.12). ESP200 uses 71 % of flash; ESP201 with cloud control uses 90 % (libraries: WebSockets 2.7.2, ArduinoJson 7.4.3).

## What the firmware does

| Feature | ESP200 sketch | ESP201 sketch |
|---|---|---|
| Web server | port 80 | port 80 |
| Relays | 1 (GPIO 23), 2 (GPIO 22), active LOW | 1 (GPIO 23), active LOW |
| Switching | `/on`, `/off`, `/toggle` `?relay=N` | same (relay 1) |
| Status | `/status` with `timerApi: 2`, `relays[]`, `timers[]` (id, relay, action, repeat, seconds, remaining), ssid, rssi, uptime | same |
| Timers | up to 10; create `/timer?relay&action&seconds[&repeat]`; `/timers`; `/timer/cancel?id=` or `?relay=`; `/timer/clear` | same |
| Wi-Fi | home only, fixed `192.168.1.200` | Pixel (DHCP) → home (DHCP) → Airtel office (fixed `192.168.1.201`) |
| Cloud control | no | yes: Supabase Realtime, check-in every 60 s, relay restored after a power cut ([13](13-cloud-control.md)) |
| CORS | headers on every response, `OPTIONS` → 204 | same |

The contract the app relies on is specified in [esp32-timer-firmware.md](esp32-timer-firmware.md).

## Important: what's on the boards vs. in the repo

- **ESP200 on the wall runs an older sketch** than `firmware/esp200/esp200.ino`. Its `/status` has no `timerApi`, and its timers have no `id` or `action`. In the app that's "basic" timer mode: new timers are blocked. Flashing `firmware/esp200` unlocks full timers automatically.
- `firmware/esp200` only knows the **home** network. If ESP200 should also use Pixel → home → office like ESP201, that block still needs adding.
- `firmware/esp201/secrets.h` is git-ignored, so on a new computer copy `secrets.example.h` and fill in all three networks (the Pi's `~/Arduino/relayinnetworkfor201esp` sketch has the real values).
- ESP200 still uses a **fixed hotspot IP**. ESP201 now uses DHCP on the hotspot and reports its IP through the cloud.
- **ESP201 on the board is `firmware/esp201`** (flashed from the Pi on 2026-09-30).

## Changing the firmware

Ask for changes here, in the same chat as the app. Keep these rules (from the spec):

1. Never change `/on`, `/off`, `/toggle` or `/status` shapes that the app reads.
2. Creating a timer never switches the relay; a timer **sets** its action and never toggles.
3. Timer ids are unique since boot and never reused. Up to 10 timers. Non-blocking `millis()`, with drift-free repeat.
4. Manual ON/OFF never cancels timers.
5. `/timer/clear` and `/timers/clear` must respect `?relay`. The old ESP200 firmware ignores it and wipes everything.
6. Only report `"timerApi": 2` once all of the above works.

## Uploading

See [`firmware/README.md`](../firmware/README.md). In short: Arduino IDE → open the `.ino` → Board **ESP32 Dev Module** → Port → Upload. Or from Terminal:

```bash
CLI="/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli"
"$CLI" compile --fqbn esp32:esp32:esp32 firmware/esp200
"$CLI" upload  --fqbn esp32:esp32:esp32 -p /dev/cu.usbserial-XXXX firmware/esp200
```

Then check `curl http://<ESP32 IP>/status` shows `"timerApi":2`.

### From the Pi 5 over SSH

The Pi (`Dhanush-Ramasamy@192.168.1.100`) has Arduino IDE 1.8.19 (`/usr/local/bin/arduino`), ESP32 core 3.3.12 and esptool 5.3.1. An ESP32 plugged into it shows up as `/dev/ttyUSB0`. Checked on 2026-09-30: the ESP200 sketch compiles headless on the Pi in about 1.5 minutes.

```bash
ssh Dhanush-Ramasamy@192.168.1.100
# compile only (doesn't touch the ESP32)
arduino --verify --board esp32:esp32:esp32 --pref build.path=/tmp/hc-build \
  ~/Arduino/relayinnetworkfor201esp/relayinnetworkfor201esp.ino
# compile + upload (resets the ESP32; relays go OFF while it reboots)
arduino --upload --board esp32:esp32:esp32 --port /dev/ttyUSB0 --pref build.path=/tmp/hc-build \
  ~/Arduino/relayinnetworkfor201esp/relayinnetworkfor201esp.ino
```

The Pi's disk is almost full (1.2 GB free), so keep builds in `/tmp`. The Pi's copy of the cloud sketch is `~/Arduino/esp201`, with WebSockets and ArduinoJson in `~/Arduino/libraries`. Close the Pi's Arduino Serial Monitor first, or the upload fails with "port is busy". When copying from the Mac, use `COPYFILE_DISABLE=1 tar …`: macOS `._` files break the Pi's build.
