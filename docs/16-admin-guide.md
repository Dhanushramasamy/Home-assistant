# 16 · Admin guide: add a new ESP32 (Pi 5 only)

The step-by-step guide for adding a brand-new ESP32 using just the app and the Raspberry Pi 5. The illustrated PDF of the same steps, with real app screenshots, is kept privately in `docs/private/guide/Add-a-new-ESP32-board.pdf` (git-ignored, because it shows usernames, Wi-Fi names and IPs). Technical background is in [14 · Adding a board](14-adding-a-board.md).

**What you need:**
- a new ESP32 ("ESP32 Dev Module");
- a 5V relay module;
- a USB data cable;
- the Pi 5;
- the names and passwords of the Wi-Fi networks the board should use.

The Pi already has Arduino IDE 1.8.19, the ESP32 boards, and the WebSockets and ArduinoJson libraries.

## 1. Wire the ESP32 to the relay module

| ESP32 pin | Relay module | What it does |
|---|---|---|
| GPIO 23 | IN1 | Switches relay 1 |
| GPIO 22 | IN2 | Switches relay 2 (more relays: GPIO 21 → IN3, GPIO 19 → IN4) |
| VIN (5V) | VCC | Powers the relay coils |
| GND | GND | Common ground |

Test with nothing on the relays' COM / NO terminals first. Have an electrician do the 220V wiring.

## 2. Open Settings → Boards

On the Pi, open the browser, go to `prp-home-assistant.vercel.app` and sign in as the admin. Then tap the gear (Settings), then **Boards**, then **Add board**.

## 3. Describe the board

| # | Field | Example | What it's for |
|---|---|---|---|
| 1 | Name | `esp202` | The board's ID. It links the board to its switches and to its cloud login. Lower-case letters, digits or dashes. Can't be changed later |
| 2 | Label | `Hall` | Friendly name in the Boards list |
| 3 | Number of relays | `2` | Relays you'll use (1–8); one switch per relay |
| 4 | Relay 1 pin | `GPIO 23` | Pin wired to IN1 |
| 5 | Relay 2 pin | `GPIO 22` | Pin wired to IN2 |
| 6 | Relay turns on when pin is | `LOW` | Right for most modules. If relays are ON when the app says OFF, change to HIGH and upload again |

## 4. Add its Wi-Fi networks

| # | Control | What it does |
|---|---|---|
| 7 | Priority 1, 2, … | The order the board tries networks in: 1 first |
| 8 | Wi-Fi name | Exactly as your phone shows it. The ESP32 only sees 2.4 GHz Wi-Fi |
| 9 | Password | 8–63 characters, stored encrypted. "Saved — type to change" means a password is saved; leave the field empty to keep it |
| 10 | ↑ ↓ | Change a network's priority |
| 11 | Remove | Delete a network |
| 12 | + Add Wi-Fi | Add another network (up to 8) |

No static IP is needed anywhere. Each Wi-Fi gives the board an address, and the app reaches the board through the cloud.

## 5. Save and download the code

1. Tap **Save and download code** (13 = Add board / Save, 14 = Save and download code). The board is saved, it gets its own cloud login, and `esp202.zip` goes to the Pi's **Downloads** folder.
2. File Manager → Downloads → right-click the zip → **Extract Here**. You get a folder containing:

| File | What it is |
|---|---|
| `esp202.ino` | The common program every board runs |
| `cloud.h` | The cloud connection |
| `board_config.h` | This board's name, relays, Wi-Fi and login. **Keep private** |
| `README.txt` | Short upload steps |

## 6. Upload with Arduino IDE on the Pi

1. Plug the ESP32 into the Pi by USB, and open Arduino IDE (Programming → Arduino IDE).
2. **File → Open** → `Downloads/esp202/esp202.ino`.
3. **Tools → Board → ESP32 Arduino → ESP32 Dev Module** (once).
4. **Tools → Port → /dev/ttyUSB0**. If another ESP32 is plugged in, the new one is usually `/dev/ttyUSB1`.
5. **Upload** (→). It takes about 1.5 minutes on the Pi. Wait for "Done uploading."

| Problem | Fix |
|---|---|
| Stuck on `Connecting....` | Hold **BOOT** until it starts writing |
| "Port is busy" / no port | Close the Serial Monitor; replug the cable; use a data cable |
| `WebSockets.h: No such file` | Library Manager → install WebSockets (Markus Sattler) and ArduinoJson |
| Offline right after closing the Serial Monitor | Press **EN/RST** once (closing the port can leave this board in upload mode) |

## 7. Check it's online

Within about a minute, Settings → Boards shows the board with a **green dot**, its Wi-Fi, IP and last check-in.

What the board does by itself:
1. switches each relay back to its last state;
2. scans and joins the highest-priority Wi-Fi in range;
3. gets an address from that Wi-Fi;
4. logs in to the cloud;
5. listens for taps;
6. checks in every minute.

On the same Wi-Fi, `http://<its IP>/status` shows `"cloud":"online"`.

If the dot is still grey after 2 minutes:
- check the Wi-Fi names and passwords (2.4 GHz, exact spelling), then download and upload again;
- make sure that Wi-Fi has internet;
- press EN/RST.

## 8. Add a switch for each relay

Home screen → **+**, once per relay:

| # | Field | Example |
|---|---|---|
| 1 | Name | `Hall Light` |
| 2 | Room | `Hall` (or New Room…) |
| 3 | Relay | `1` (= IN1) |
| 4 | Type | Light / Fan / Plug / Other |
| 5 | Board | `esp202`. With a board, the IP field disappears |
| 6 | Add | Saves it. Tap the tile to test: the loader confirms in 2–3 s |

## 9. Give people access

Settings → **Users** → for each person, switch on the new switches → **Save**.

## Install

Power the ESP32 from any 5V USB adapter where it will live. It joins its Wi-Fi by itself and works from any phone, on any network.

## Later changes

| You want to… | Do this |
|---|---|
| Change or add Wi-Fi | Boards → tap the board → edit → **Save and download code** → upload again |
| Add a relay | Wire it, raise "Number of relays", download and upload again, add its switch |
| Move an existing ESP32 (e.g. ESP200) | Add it as a board (`esp200`), upload the downloaded code, set **Board** on its switches |
| Remove a board | Boards → tap it → **Delete board** (its switches stay, unlinked) |
