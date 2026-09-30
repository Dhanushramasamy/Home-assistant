# ESP32 relay project: history and current state

A summary of the ChatGPT conversation "Control Light Fan Raspberry Pi" (442 messages), imported into this project so the app and the firmware can be worked on in one place.

- Full conversation (local only, contains Wi-Fi passwords): `docs/private/chatgpt-esp32-chat.md`. The `docs/private/` folder is git-ignored.
- Firmware: `firmware/esp200/` and `firmware/esp201/` (see `firmware/README.md`).
- Timer API contract between the app and the firmware: `docs/esp32-timer-firmware.md`.

---

## 1. How the project evolved

1. **Raspberry Pi first.** The goal was to switch a bedroom light and fan from a phone over the internet. It started with a Raspberry Pi (4 and 5) driving a 2-channel relay module from GPIO.
   - Wiring notes that came out of it: JD-VCC/VCC jumper (keep it on unless you power the relay coils from a separate 5 V supply), NO/COM wiring for a light, and the Pi's 5 V pin being enough for the relay module.
2. **ESP32 takes over.** An ESP32 (30-pin dev board) runs an HTTP server and switches the relay directly. The Pi is no longer needed in the path.
   - First uploads were from Arduino IDE 1.8.19 on the Pi; later from a Mac or Windows laptop.
   - Board: `ESP32 Dev Module`.
3. **Remote access experiments.** Phone → internet → Pi (via **Tailscale**) → LAN → ESP32. This worked for the phone only, because Tailscale has to be installed on each device. A public static IP / port-forwarding option was discussed but not set up (CGNAT on the ISP side).
4. **Static IPs.** Fixed addresses were agreed on so devices can be found by the app:
   - Airtel office (`192.168.1.x`): Pi 5 = `.100`, Pi 4 = `.101`, ESP200 = `.200`, ESP201 = `.201`.
   - Pixel hotspot (`10.196.10.x` at the time, gateway `.202`): ESP201 = `.201`.
5. **Wi-Fi priority.** ESP32s try networks in order: Pixel hotspot → home Wi-Fi → Airtel office.
6. **Side experiment.** An HC-SR04 ultrasonic sensor was tested on the ESP32 (distance readings worked). It's not part of the current firmware.
7. **Timers.** Several independent timers per ESP32 (Timer API v2: ids, ON/OFF action, repeat, max 10), written to match this app.

## 2. Devices

| | ESP200 | ESP201 |
|---|---|---|
| Location | Home bedroom | Erode bedroom |
| Relays | Relay 1 = GPIO 23 (Light), Relay 2 = GPIO 22 (Fan) | Relay 1 = GPIO 23 |
| Relay logic | Active LOW (`RELAY_ON LOW`) | Active LOW |
| Networks in the sketch | Home Wi-Fi `Dhanush-Wifi-2.4G`, fixed `192.168.1.200` | 1. Pixel hotspot, fixed `10.196.10.201` · 2. Home Wi-Fi, DHCP · 3. Airtel office `Airtel_kaly_5220`, fixed `192.168.1.201` |
| HTTP | port 80 | port 80 |
| Timer API | v2 (`timerApi: 2`, up to 10 timers) | v2 |
| Sketch source | ChatGPT message 427 | ChatGPT message 441 (last in the chat) |

## 3. Current state and known issues (checked from this project)

1. **ESP200 is running an older sketch than `firmware/esp200/`.** Its `/status` has no `timerApi` field and its timers have no `id`/`action`, so the app shows running timers but won't create new ones ("needs a firmware update"). Flashing `firmware/esp200/esp200.ino` unlocks full timers automatically.
2. **ESP200's newest sketch only knows the home network.** You've said your ESP32s run Pixel → home → office. If the ESP200 on your desk has that, it isn't in this sketch yet; add the same three-network block that ESP201 uses.
3. **Phone hotspot addresses change.** Android picks a new random range each time the hotspot starts (seen: `10.196.10.x`, `10.198.10.x`, `10.233.105.x`). A fixed `10.196.10.201` only works on days the range matches, which is why the ESP32 shows "connected" but can't be reached. Fix: on the Pixel network, get an address by DHCP, then switch to `<today's first three numbers>.201` (snippet in `firmware/README.md`).
4. **The public share link contains Wi-Fi passwords.** Delete it in ChatGPT → Settings → Data controls → Shared links.
5. **`/timers/clear` ignores `?relay`** in the firmware currently on ESP200, and wipes every timer. The app never calls it; `firmware/esp200` implements the relay-scoped version.

## 4. What the app expects

- ON/OFF: `GET /on?relay=N`, `GET /off?relay=N`
- State: `GET /status` with `relays[]`, `timers[]` (each with `id`, `relay`, `action`, `repeat`, `seconds`, `remaining`) and `timerApi: 2`
- Timers: `GET /timer?relay=N&action=on|off&seconds=S[&repeat=true]`, `GET /timer/cancel?id=ID`, `GET /timer/cancel?relay=N`
- CORS headers on every response; `OPTIONS` → 204

Full contract: `docs/esp32-timer-firmware.md`.
