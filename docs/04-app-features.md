# 04 · App features

## Login

- **Screen:** "Hi there! Welcome Home", with username and password in a glass card and a lime arrow button. A wrong password shakes the form.
- **How it works:** the password is checked on the server (`POST /api/auth/login`). On success the server sets a signed, httpOnly session cookie that lasts 30 days. A reload keeps you signed in; Sign Out clears it.
- **Switch account:** from the avatar menu (top left) or Settings → Account.

## Home screen

- **Top:** your initial in a lime circle (menu: Switch Account, Sign Out), plus Search and Add (admin only) as round glass buttons.
- **Greeting:** "Hi <name>! Welcome Home".
- **Room pills:** All plus each room. The active one is white. Android back returns to All.
- **Device tiles** (one per relay):
  - icon circle (lime when on; the fan icon spins);
  - ↗ arrow, which opens the device screen;
  - room and name, with a red dot when the device isn't responding;
  - timer chip: "Off in 10:14 +2" (next timer plus how many more), or "N saved · offline";
  - **On/Off pill**: lime knob when on, white when off, "—" and disabled when the real state is unknown. A **spinner** in the knob means it's waiting: for the first check when the app opens, or for the board to confirm a tap. While it spins, more taps on that switch are ignored.
- **Floating bottom nav:** Home and Settings (admin). It's hidden for users who only have Home.
- **Empty state:** "No Devices", with Add Device / Load Sample for the admin. A user with no granted devices sees an empty home.

## Device screen (↗ on a tile)

1. **Header:** Back, device name and room, and a ⋮ menu (Test Connection, plus Edit and Delete for the admin).
2. **Power pill** (large).
3. **3D model:** a lamp with warm bulb and halo, or a fan with a lime LED ring whose blades spin. Plugs and "other" show a big glowing icon button.
4. **Status tiles:** Status (Online / No Response), Relay (1 or 2), Connection (Direct / Gateway).
5. **IP card:** the IP address, with Wi-Fi name, signal (dBm) and uptime, and a **Test** button that runs the connection check.
6. **Timers** (see below).

## Timers

Timers run **on the ESP32**, so they fire even when every phone is closed, and are saved in its flash so they survive a restart. Full logic: [17 · Timers](17-timers.md).

**Creating one** (only on firmware with Timer API v2):
- Action: **Turn On** or **Turn Off**.
- When:
  - **After:** quick picks 10m / 30m / 1h / 2h, or type hours, minutes and seconds;
  - **At time:** a clock time; the app works out the seconds until then, today or tomorrow.
- **Repeat:** runs the same action every interval ("Turn OFF every 1 h 45 min"). It never toggles.
- Limits: 1 second to 24 hours; 10 timers per ESP32. Clear messages when these are exceeded.

**Running timers:** one card each, showing "Timer #3 · Turn OFF", a live countdown, "One-time" or "Repeating every 10 min", and Cancel. There's also **Cancel All Timers** for that relay, with confirmation.

**Old firmware** ("basic" mode, the ESP200 today):
- running timers still show, as "Turn OFF";
- there's one **Cancel Timers on This Relay** button;
- the create form is replaced by "New timers need a firmware update", because that firmware would switch the relay ON immediately.

**Offline device:** no timer is shown as running. Saved timers appear in a dashed box, "Saved in the app · not confirmed on the device".

## Switching and confirmation

- **Cloud switch:** the spinner stays until the board itself reports the new state (normally 2–3 s).
  - Board offline → error straight away ("Its board isn't connected").
  - No answer in 10 s → error, and the switch shows the real state.
  - The board reports another state → the real state, with an error.
- **Board without cloud (ESP200), opened from the live site:** an error at once says it only works on its own Wi-Fi.

## Live sync between phones

- Every open app re-reads the switch list every **3 seconds** while visible, and immediately when brought back to the front.
- Background reads never change a switch that's waiting for confirmation.
- Status is also re-checked every 10 s per switch (15 s on the open device screen).

## Settings (admin)

| Tab | What it does |
|---|---|
| **Account** | Your name and role; Switch Account; Sign Out |
| **General** | Your role; **Change Password**; **New User** (username, password, Administrator switch) |
| **Users** | For each user, a switch per device; **Save** per user (shows "Unsaved changes", then "Saved ✓" only after reading it back from the server). Warns before leaving with unsaved changes. Shows a banner if the access table isn't set up |
| **Boards** | Every ESP32 with online dot, Wi-Fi, IP, relays, last check-in. **Add board / edit**: name, label, relays and pins, relay type, Wi-Fi networks in priority order; **Save**, **Download code** (ready Arduino zip), **Delete board**. See [14](14-adding-a-board.md) |
| **Network** | Network name, subnet, router; Direct / Raspberry Pi gateway mode (for boards without the cloud) |
| **Devices** | List of devices with edit, delete and test |
| **Controller** | Gateway / controller details |
| **Advanced** | Reset to sample devices, clear devices |

Users who aren't admins don't see Settings in the nav. The server also blocks admin actions for them (403).

## Add / Edit device

iOS-style form sheet with Cancel / title / Add or Save:
- name, room (pick one or add a new room), relay 1–4;
- type (light, fan, plug, other);
- **Board**: the board's name from Settings → Boards (e.g. `esp202`). With a board, no IP is needed and the IP row is hidden;
- IP address as four boxes, only for a switch without a board, with a warning if it's outside the configured subnet.

## Notifications

A small pill at the top centre shows only the latest message and disappears after 2.5 s. It only appears for add / save / delete, errors, and timer problems. Switching a device on or off shows none.

## Switch sound and haptics

- **Sound:** a clear mechanical click made with Web Audio (no audio file). A two-stage "cli-click" when turning ON, a single lower click when turning OFF, with a limiter so it stays clean on phone speakers.
- **Haptics:** a vibration pulse on Android. On iPhone (iOS 18+), a hidden native switch gives a system haptic.
- On iPhone, the silent switch mutes web sounds; the haptic still works.

## Navigation

The Android / browser back gesture closes the top layer first: open sheet → search → room filter or Settings → then leaves the app. Closing a sheet with its own button keeps history balanced.

## Motion

Staggered tile entrance, sliding pills (tabs, nav, segmented controls), rolling numbers, spring sheets, a knob that stretches while pressed, and a slow background zoom. Everything respects Reduce Motion.
