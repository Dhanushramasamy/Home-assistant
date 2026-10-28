# Pi 5 and ESP32 hardware handoff

This is the project story and repeatable working guide for using the Raspberry Pi 5 to build and flash ESP32 boards for this Home Control app. It is intended to give a future work session enough context to continue without re-explaining how the Pi, boards, app, database, and editor fit together.

## The story so far

The project began as a way to switch lights and fans with an ESP32 and relay module. Early versions used direct local network requests, so the phone, app server, and ESP32 had to be on the same Wi-Fi. The Raspberry Pi was first used to experiment with relay wiring and later became the reliable USB flashing station.

We then moved the boards to cloud control. The app stores each board in Supabase. An ESP32 joins Wi-Fi, signs in with its own board account, keeps an outbound Supabase connection, receives commands, and reports its state. That lets a signed-in app control a board even when the phone and board are on different networks. The app's **Settings → Boards → Download code** flow generates a ZIP containing the shared firmware and that board's private configuration.

ESP201 is the board we have been using for the servo work. It is registered as `esp201`; its servo signal is configured on GPIO 18. It has also been used with a relay on GPIO 23. The board's address changes with Wi-Fi; Settings → Boards shows its latest address and online state. The server log from the first servo attempt showed the board online and servo-ready at 90°, but no acknowledgement for command sequence 19, so the API waited and returned 504. A cloud command must be acknowledged by the firmware; an online status alone does not mean the servo command was handled.

The current Home Control behavior being added is a persistent switch for each servo device: **ON** moves to the device's saved angle (default 90°), **OFF** returns to 0°, and the saved movement speed is applied by the ESP32's gradual movement loop. Angle and speed are configured when the device is created and can be changed from Edit Device. Relay devices continue to use their relay outputs.

## How the pieces fit together

| Piece | Role |
|---|---|
| Mac project folder | Source code and documentation: `firmware/template` is the shared ESP32 program; `app/`, `components/`, and `lib/` are the web app and server. |
| Home Control app | Settings → Boards saves board identity, relay/servo pins and Wi-Fi configuration, then downloads a board-specific ZIP. The Home device form saves servo ON angle and speed with the device. |
| Supabase | Stores board records and pending commands. The board reports its actual servo angle, target angle, and command acknowledgements. Existing databases need the SQL migrations described below. |
| Raspberry Pi 5 | USB programming station. SSH is available at `Dhanush-Ramasamy@192.168.1.100` on the known home/office networks. The Pi has Arduino IDE 1.8.19, ESP32 core 3.3.12, WebSockets and ArduinoJson. |
| ESP32 | Runs generated `board_config.h` plus the shared sketch. It handles relays and, when configured, servo PWM. The app reaches it through its Supabase connection. |

The Pi 5's address is network-dependent: `.100` on the documented home and office Wi-Fi; it gets an address from DHCP on a phone hotspot. ESP201's recorded Airtel address `.131` is also DHCP and may change. Prefer the board's online/IP details in Settings over assuming an old address.

## Get to the Pi 5

From Terminal on the Mac, connect with:

```sh
ssh Dhanush-Ramasamy@192.168.1.100
```

This uses the existing SSH key setup. If it cannot connect, first put the Mac and Pi on the same Wi-Fi and check the Pi's current address in the router; the office address is not guaranteed on a hotspot. Disconnect with `exit`.

The ESP32 plugs into the Pi by USB. The usual port is `/dev/ttyUSB0` (CH340); if another USB serial board is attached, check which port appeared rather than selecting blindly. Close Arduino IDE's Serial Monitor before upload because it can hold the port open.

## The editor and source of truth

Open this project folder in the code editor on the Mac. For app and shared firmware changes, edit the tracked files here:

- App/API: `app/`, `components/`, `lib/`, and `types/`.
- Shared board firmware: `firmware/template/board.ino` and `firmware/template/cloud.h`.
- Board setup and stored values: `supabase/` and `docs/`.

Do not treat a generated `board_config.h` or `~/Arduino/boards/esp201` as the main source. They are the per-board upload package produced by the app. Do not paste Wi-Fi passwords, board login passwords, service-role keys, or other secrets into committed files or this guide. The generated configuration contains credentials and should stay private.

## Set up or update a board in the app

1. Sign in as an admin and open **Settings → Boards**.
2. Add or edit the board. Set a stable lower-case board ID, label, relay count/pins, relay active level, optional servo pin, and Wi-Fi networks in priority order. ESP32 Wi-Fi is 2.4 GHz.
3. For the current servo, use board ID `esp201` and signal pin GPIO 18. Preserve the existing board setup rather than making a duplicate board record.
4. Save and choose **Download code**. The ZIP contains `<board-id>.ino`, `cloud.h`, `board_config.h`, and upload notes. `board_config.h` has private credentials.
5. On an existing Supabase installation, run the required SQL migrations in the Supabase SQL Editor (see Database changes below) before relying on new servo columns or board configuration fields.

## Flash the generated firmware using the Pi 5

The straightforward supported route is Arduino IDE on the Pi:

1. Transfer the board ZIP to the Pi (for example, to `~/Downloads`) without putting its private contents into Git.
2. On the Pi, extract it. Open the extracted `<board-id>.ino` in Arduino IDE.
3. Select **Tools → Board → ESP32 Arduino → ESP32 Dev Module**.
4. Select **Tools → Port → /dev/ttyUSB0** (or the port confirmed for this board).
5. Close Serial Monitor if open, then press **Upload** and wait for “Done uploading”. If the console stays at `Connecting...`, hold BOOT until writing starts.
6. If the board stays offline after upload or after closing a serial reader, press its EN/RST button once. Opening/closing a serial port can reset some ESP32 boards and leave one waiting for download mode.
7. In **Settings → Boards**, wait for the board to return online. Confirm the correct Wi-Fi, IP, and recent check-in. For local diagnosis, open `http://<board-ip>/status` from a device on the same network.

The Pi has limited free disk space. Use `/tmp` for build output when compiling from the command line. The documented headless tool is `/usr/local/bin/arduino`; compile-only and upload examples are in [09 · Firmware](09-firmware.md#uploading) and [16 · Admin guide](16-admin-guide.md#6-upload-with-arduino-ide-on-the-pi). Avoid creating unnecessary build folders in the Pi home directory.

## Servo wiring and use

A typical hobby servo has three leads: signal, power, and ground. Connect signal to the configured servo GPIO (GPIO 18 for ESP201), and use an appropriately rated regulated 5 V supply for the servo. Join the servo supply ground to ESP32 ground so the signal has a shared reference. Do not draw servo motor current from an ESP32 GPIO or 3.3 V output. Check the servo's lead colors and voltage/current requirements for its exact model.

After the board has the current firmware and reports `servo.ready: true`:

1. In Home, choose **+ → Servo**, name it, choose its room and servo-enabled board.
2. Set **ON angle** (1–180°, default 90°) and **Movement speed** (degrees per second, default 20).
3. The Home card's switch sends ON to the saved angle and OFF to 0°. Edit the device to change those saved values; they persist in the `switches` table.
4. The board moves a degree at a time according to the configured speed, reports actual and target positions, and acknowledges the cloud command. The speed controls movement time; it does not change the servo's electrical supply or mechanical torque.

If a servo chatters, stalls, resets the board, or moves inconsistently, disconnect it and check its power supply, shared ground, mechanical load, and safe angle range before retrying. Some servos cannot safely travel through the full 0–180° range.

## Relay modules

Each relay input uses its configured GPIO. The current ESP32 template defaults in the board wizard include GPIO 23 for relay 1 and GPIO 22 for relay 2. Relay modules are commonly active-low; the app's **relay active level** setting must match the module. A mismatch makes the physical relay appear inverted compared with Home. Keep low-voltage relay-input wiring separate from mains wiring. Test switching with mains disconnected; mains wiring should be handled by a qualified electrician. Use a separate suitable supply for relay coils if the board/USB supply cannot provide the module's current, and connect grounds where the module design requires it.

Create one Home device per relay output, with a unique ID, relay number, and the board ID. The Home ON/OFF action controls that relay. A servo is a separate device on the board, not a relay number.

## Database changes for this servo behavior

For a fresh Supabase database, apply `supabase/four_tables.sql` and `supabase/board_setup.sql` as documented in [10 · Setup](10-setup-and-deployment.md#database-setup-supabase-sql-editor-once). For an existing install, apply the relevant migrations once in Supabase SQL Editor:

1. [`supabase/add_servo_pin.sql`](supabase/add_servo_pin.sql) if servo pin configuration is not already present.
2. [`supabase/add_servo_device_type.sql`](supabase/add_servo_device_type.sql) if servo is not already an allowed `switches.type` and the board/relay unique indexes have not been migrated.
3. [`supabase/add_servo_motion_settings.sql`](supabase/add_servo_motion_settings.sql) to add the persistent ON angle and speed fields.

The server log should show a successful `POST /api/devices/control` when using the Home switch. A 504 from the older `/api/servo` path with an online board but no matching entry in `reported.acks` means the command did not get confirmed by the running firmware. Check that the latest generated package was flashed, servo support is enabled for the same board ID, `servo.ready` is true, and the board has checked in after reboot.

## Things we learned the hard way

- A successful app page load or an `online` board badge does not prove the servo command path works; check for the command acknowledgement and target angle.
- ESP32 boards can be on a different Wi-Fi from the laptop. Cloud commands work across networks when the board has internet; direct local HTTP calls do not.
- A changed firmware template is not on a physical board until a fresh board ZIP is generated and uploaded over USB.
- Serial Monitor and serial log readers can seize the USB port or reset a board. Close them before upload; use EN/RST if the board does not reconnect afterwards.
- Keep device configuration, app source, and generated firmware aligned: app changes, Supabase schema changes, and firmware uploads are three separate steps.

## Related project notes

- [Pi and firmware upload details](docs/09-firmware.md#uploading)
- [Add a board with the app and Pi](docs/16-admin-guide.md)
- [Cloud command flow](docs/13-cloud-control.md)
- [Device and network map](docs/08-devices-and-network.md)
- [Troubleshooting](docs/11-troubleshooting.md)
- [Firmware source overview](firmware/README.md)
