# ESP32 relay firmware

Arduino sketches for the ESP32 relay controllers used by this app. History and decisions: `../docs/esp32-history.md`. App ↔ firmware contract: `../docs/esp32-timer-firmware.md`.

**Every board now uses `template/`** (ESP201 since 2026-10-01, ESP200 since 2026-10-03): one sketch for every ESP32, set up in the app (Settings → Boards) and downloaded ready to upload. See `../docs/14-adding-a-board.md`. The folders below are the older per-board sketches, kept for reference.

| Folder | Device | Relays |
|---|---|---|
| `template/` | Every board (common template) | 1–8, pins from the app |
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
