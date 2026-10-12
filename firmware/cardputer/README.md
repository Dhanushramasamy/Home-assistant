# Home Control remote for the M5Stack Cardputer

Signs in to the Home Control app as the user **`cardputer`** (a normal user with access to all switches), lists the switches and switches them or sets timers from the keyboard. Works on any Wi-Fi with internet.

| Key | List screen | Timer screen |
|---|---|---|
| `;` / `.` | move up / down | — |
| Enter | switch ON/OFF (waits for the board to confirm, like the app) | start the timer |
| `t` | open timers for the selected switch | — |
| `r` | refresh | — |
| `o` | — | Turn ON / Turn OFF |
| `0-9`, Del | — | minutes |
| `c` | — | cancel all timers on this switch |
| `` ` `` | — | back |

The header shows Wi-Fi signal and battery; offline switches show `--`.

## Files

- `cardputer.ino`: the program.
- `roots.h`: certificates for `prp-home-assistant.vercel.app`.
- `secrets.h` (git-ignored): Wi-Fi networks (home → office → Pixel) and the `cardputer` user's password. Copy `secrets.example.h` on a new computer.

## Build on the Pi 5 (Arduino IDE 1.8.19)

The Pi has the libraries (`M5Cardputer`, `M5Unified`, `M5GFX`, `ArduinoJson`) in `~/Arduino/libraries` and the sketch in `~/Arduino/boards/cardputer`.

```bash
arduino --verify --board esp32:esp32:m5stack_cardputer --pref build.path=/tmp/hc-cp \
  ~/Arduino/boards/cardputer/cardputer.ino          # first build ~6 min
# the app binary: /tmp/hc-cp/cardputer.ino.bin
```

## Run it from the SD card (M5Launcher)

1. Copy `cardputer.ino.bin` (saved as `HomeControl-Cardputer.bin`) to the Cardputer's SD card.
2. On the Cardputer: Launcher → SD → select the file → Install / Launch.

Uploading over USB instead (`--upload --port /dev/ttyACM0`) replaces the launcher, so use the SD card to keep it.

The `.bin` contains the Wi-Fi passwords and the `cardputer` user's password. Keep it private. To revoke it, delete the `cardputer` user (Settings → Users) or change its password.
