# ESP32 relay firmware

Arduino sketches for the ESP32 relay controllers used by this app. History and decisions: `../docs/esp32-history.md`. App ↔ firmware contract: `../docs/esp32-timer-firmware.md`.

**Every board now uses `template/`** (ESP201 since 2026-10-01, ESP200 since 2026-10-03): one sketch for every ESP32, set up in the app (Settings → Boards) and downloaded ready to upload. See `../docs/14-adding-a-board.md`. The folders below are the older per-board sketches, kept for reference.

| Folder | Device | Relays |
|---|---|---|
| `template/` | Every board (common template) | 1–8, pins from the app |
| `cardputer/` | M5Stack Cardputer **remote** (not a relay board) | — : switches and timers from the keyboard; see `cardputer/README.md` |
| `recorder/` | M5Stack Cardputer **voice recorder** (not part of Home Control) | — : records WAV to the SD card (`/recordings`), plays, deletes. **Cardputer ADV: build with esp32 core 3.2.0** (3.3.x / IDF 5.5 gives a silent mic), M5Unified 0.2.23 |
| `ir-remote/` | M5Stack Cardputer **IR remote** (offline, not part of Home Control) | — : AC encoder (Panasonic/LG/Toshiba) + raw Flipper `.ir` sender on G44. ADV has IR **TX only** (no receiver, can't learn remotes) |
| `bt-hid/` | M5Stack Cardputer **Bluetooth keyboard + air-mouse** (offline) | — : pairs as a BLE HID keyboard+mouse ("Cardputer KB/Mouse"); keys type, IMU-tilt or `; . , /` move the pointer. Uses patched **ESP32-BLE-Combo** (its pre-3.x `setValue(std::string)` / `BLEDevice::init(std::string)` calls need the new String / `(uint8_t*,len)` API for core 3.x); fits the default partition (~1.15 MB). `KEY_*` macro clash with M5's `Keyboard_def.h` resolved by `#undef` between the includes |
| `esp200/` | ESP200, home bedroom | Relay 1 = GPIO 23 (Light), Relay 2 = GPIO 22 (Fan) |
| `esp201/` | ESP201, Erode bedroom | Relay 1 = GPIO 23 · cloud control (`cloud.h`, see `../docs/13-cloud-control.md`) |

## Wi-Fi passwords

Each folder has a `secrets.h` with the Wi-Fi names and passwords (and, for cloud boards, the board's Supabase sign-in). **It is git-ignored and never pushed to GitHub.** `secrets.example.h` shows the format; on a new computer, copy it to `secrets.h`, fill in Wi-Fi, and run `node scripts/board-login.mjs esp201 --secrets firmware/esp201/secrets.h` for the cloud part.

Cloud boards need two libraries: `arduino-cli lib install WebSockets ArduinoJson` (or Library Manager in the IDE).

## Upload with Arduino IDE

1. Open `esp200/esp200.ino` (or `esp201/esp201.ino`) in Arduino IDE.
2. Tools → Board → **esp32 → ESP32 Dev Module**.
3. Tools → Port → the ESP32's USB port.
4. Click **Upload**. Open the Serial Monitor at **115200** baud to see which Wi-Fi it joined and its IP.

## Upload from Terminal (no install needed)

Arduino IDE ships with `arduino-cli`:

```bash
CLI="/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli"
"$CLI" compile --fqbn esp32:esp32:esp32 firmware/esp200
"$CLI" upload  --fqbn esp32:esp32:esp32 -p /dev/cu.usbserial-XXXX firmware/esp200   # port from: ls /dev/cu.*
"$CLI" monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

## After uploading, check it

```bash
curl http://<ESP32 IP>/status
```

It should include `"timerApi":2`. The app then enables full timers for that device automatically.

## Phone hotspot: fixed ".201" on a changing network

Android picks a new address range each time the hotspot starts, so a fixed hotspot IP like `10.196.10.201` stops working. On the Pixel network, get an address automatically first, then move to today's range with the device's own ending:

```cpp
// Pixel hotspot: learn today's range, then use a fixed ending (.200 ESP200, .201 ESP201).
WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE, INADDR_NONE);   // DHCP first
WiFi.begin(PIXEL_SSID, PIXEL_PASSWORD);
while (WiFi.status() != WL_CONNECTED) delay(200);

IPAddress gw = WiFi.gatewayIP(), mask = WiFi.subnetMask();
IPAddress fixedIP(gw[0], gw[1], gw[2], 201);
WiFi.config(fixedIP, gw, mask, gw);
WiFi.reconnect();
Serial.print("Hotspot IP: ");
Serial.println(WiFi.localIP());
```
| `ir-remote/` | **IR Remote (all-in-one)** — home menu with **AC Remote** (Panasonic/LG/Toshiba encoder, full power/temp/mode/fan, per-brand Model variants) and **IR Files** (browse the SD, send any raw Flipper `.ir` incl. the whole Flipper-IRDB and your captures). Sends on G44. Supersedes `ir-ac-remote` + `ir-blaster`. Build with esp32 core 3.2.0 |
