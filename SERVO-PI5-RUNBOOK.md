# Servo and ESP32 runbook

This is the repeatable record for the Home Assistant servo work. It explains how to reach the Pi 5, identify the correct ESP32, flash firmware, wire the servo, and diagnose the app.

## Boards and pins

### ESP201 (Home Assistant servo board)

- Board ID: `esp201`
- Servo signal: GPIO18 (the header is labelled `D18`)
- Relay 1: GPIO23 when configured
- Firmware source/package: `firmware/template/board.ino` and the generated `~/Arduino/boards/esp201/esp201.ino`
- The board connects to Wi-Fi and Supabase, then listens for cloud commands.

### ESP202 (new test board)

- This is a separate board and must have its own board record and credentials.
- The standalone test used GPIO13 (`D13`) and swept 0–180 degrees.
- The test sketch is `firmware/servo-sweep/servo-sweep.ino`.
- A standalone sweep sketch does not appear in Home Assistant. ESP202 needs a generated board package with board ID `esp202`, its servo pin, Wi-Fi, and cloud credentials before the app can control it.

Do not identify boards by `/dev/ttyUSB0` or `/dev/ttyUSB1`; those names change when boards are plugged in. Identify the board by its MAC address or by testing one board at a time.

## Reaching the Pi 5

From the Mac terminal:

```sh
ssh Dhanush-Ramasamy@192.168.1.100
```

The address is assigned by the network and can change. On the Pi, the Arduino CLI/IDE is installed under Arduino 1.8.19 with ESP32 core 3.3.12. A CH340 board normally appears as `/dev/ttyUSB0` or `/dev/ttyUSB1`.

Check the USB devices:

```sh
lsusb
ls -l /dev/ttyUSB* /dev/ttyACM*
```

Check a board's bootloader and MAC address:

```sh
/home/Dhanush-Ramasamy/.arduino15/packages/esp32/tools/esptool_py/5.3.1/esptool --port /dev/ttyUSB1 chip-id
```

Use the actual port that exists. Close Arduino Serial Monitor before flashing; it can hold the port open.

## Flashing firmware

The safe application workflow is **Settings → Boards → Add/Edit → Save and download code**. The generated package contains private Wi-Fi and cloud credentials and must not be committed.

For a package already on the Pi, the headless upload command is:

```sh
arduino --upload \
  --board esp32:esp32:esp32 \
  --port /dev/ttyUSB1 \
  --pref build.path=/tmp/esp201-build \
  ~/Arduino/boards/esp201/esp201.ino
```

Replace the port, build directory, and sketch path for the board being flashed. The board target used for these classic ESP32-WROOM boards is **ESP32 Dev Module** (`esp32:esp32:esp32`).

If the upload stops at `Connecting.....`, hold **BOOT**, tap **EN** once, and keep holding BOOT until `Writing at ...` appears. On the pictured board, BOOT is left of the USB connector and EN is right of it. If `esptool` never receives serial data even with BOOT/EN, suspect the board's boot/reset circuit; a CH340 appearing in `lsusb` alone does not prove the ESP32 module is responding.

## Wiring

A hobby servo normally has signal, power, and ground:

| Servo lead | ESP201 | ESP202 test |
|---|---|---|
| Signal | GPIO18 / D18 | GPIO13 / D13 |
| Power | Separate regulated supply suited to the servo | Same |
| Ground | Servo supply ground joined to ESP32 GND | Same |

Do not power the motor from an ESP32 GPIO or 3.3 V pin. VIN/USB power may be insufficient for a servo's startup or stall current. Disconnect the mechanical linkage for endpoint tests.

## Home Assistant servo behavior

The device stores an ON angle, an OFF angle, and movement speed. A switch command queues a cloud servo command containing the target angle and speed. The ESP32 moves one degree at a time, reports its current and target angles, and records an acknowledgement. The app waits for that acknowledgement before completing the command.

The UI loader is intended for initial status loading or an active movement. An idle servo at an intermediate angle is treated as OFF so the card does not remain in an endless unknown state. During a command, the app shows the loader until the board reports that movement has finished.

If the board is online but a command returns 504, check the board's `reported.acks`, `servo.ready`, board ID, and that the latest generated firmware was uploaded. Online status alone does not prove the command handler is running.

## PWM endpoint calibration

The firmware converts logical 0–180° into PWM pulse widths in `firmware/template/board.ino`. The current calibration is:

```cpp
SERVO_MIN_US = 500;
SERVO_MAX_US = 2400;
```

This gives a wider physical travel than the earlier 1000–2000 µs range. It was uploaded successfully to the ESP201 package and verified on the board. If the servo buzzes, stalls, heats, or hits a hard stop, disconnect power and reduce the range, for example to 600–2300 µs. The app's 0° and 180° are logical commands; they do not guarantee a particular mechanical angle for every servo.

## First test after flashing

1. Disconnect the linkage and keep fingers clear.
2. Connect signal, external power, and common ground.
3. Wait for the board to show online in Settings.
4. Press OFF and confirm a smooth move to the configured OFF endpoint.
5. Press ON and confirm a smooth move to the configured ON endpoint.
6. Check the Pi serial monitor at 115200 baud for Wi-Fi, cloud, servo-ready, and command messages.
7. Only after both endpoints are safe should the linkage be attached.

## Current known board history

The original ESP202 board repeatedly exposed a CH340 but did not answer the ESP32 bootloader (`No serial data received`). A replacement board answered successfully and was used for the GPIO13 sweep test. Because USB port names and board labels can be confused, always use `esptool chip-id` and a single connected board before flashing.

### Dead "202" board diagnosis (29 Oct 2026)

A board labelled 202 was diagnosed on the Pi 5 with the same `No serial data received` failure. It may be the original ESP202; its MAC address could not be read. The Pi side was clean: one CH340 on `/dev/ttyUSB0`, no process holding the port, `throttled=0x0`, 5.11 V supply, and `usb_max_current_enable=1`.

The ESP32 ROM banner stopped after `ets Jul 29 2019`, about 1.3 ms after every reset, and the RX line then read a `0x00` byte every ~440 ms. The cut-off point was the same for reset holds of 0.02 s, 0.5 s, and 3 s. With EN held low, the line was silent.

Multimeter readings:

| Condition | 5V/VIN | 3V3 |
|---|---|---|
| Powered, EN tied to GND (chip held in reset) | 4.16 V | 3.22 V |
| Powered, EN free (chip running) | 2.39 V | 1.48 V |
| Unpowered, EN wire removed (resistance to GND) | open (>2 MΩ) | 1.93 kΩ |

No part became warm. The regulator, CH340, and board wiring are healthy, and there is no short while the board is off. The ESP32 module overloads the supply only once it starts, so it is damaged. Replacing the module needs hot air and costs about as much as a new board, so it was not repaired.

The board is now a 3.3 V USB-serial adapter. With EN tied to GND, a TX-to-RX loopback test passed at 9600, 115200, 460800, and 921600 baud. Keep the EN-to-GND wire permanently fitted, wire its TX to the target's RX and its RX to the target's TX, and enter download mode on the target by hand; this board's auto-reset only drives its own ESP32. Label it "USB-Serial only" so it is not confused with a working board.

Quick test for this fault on any board: run `esptool chip-id`. If it fails, reset the board through RTS and read the raw serial output at 115200 baud. A banner that stops partway, then periodic `0x00` bytes, means the supply collapses when the chip runs. Confirm by measuring 3V3 with EN tied to GND and then with EN free.

## Source, generated files, and secrets

- Shared app and firmware source lives in `app/`, `components/`, `lib/`, `types/`, and `firmware/template/`.
- `firmware/servo-sweep/servo-sweep.ino` is a standalone hardware test.
- `~/Arduino/boards/<board-id>` on the Pi is generated upload material, not the source of truth.
- Never commit Wi-Fi passwords, board passwords, Supabase keys, or generated private configuration.
