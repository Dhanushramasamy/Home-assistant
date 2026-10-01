# 12 · Roadmap and known issues

## Do next (in order)

1. **Flash `firmware/esp200`** so ESP200 reports `timerApi: 2`. This unlocks full timers (ON/OFF later, repeat, cancel one) with no app change.
2. **Cloud control for ESP200:** add `cloud.h` like ESP201 ([13](13-cloud-control.md#adding-a-board)). ESP201 is done, and its hotspot now uses DHCP.
3. **Add Pixel → home → office to ESP200** (only ESP201 has all three today).
4. **Security clean-up:** change the admin password; delete the public ChatGPT share link.

## Planned features

### Faster cloud confirmation

- The board's report takes 2–3 s (a new TLS connection each time). Reusing one connection hung on the ESP32 (2026-10-01). Options: retry with a newer ESP32 core or a different HTTP client, or move Supabase and Vercel to Mumbai (shorter trips from India).

### Network prefix button (admin)

- Settings → Network: type today's first three numbers (e.g. `10.233.105`) and tap Apply. Every device on that ESP32 becomes `10.233.105.<its ending>`.
- One-tap "back to home (`192.168.1`)".
- An alternative is for the ESP32 to report its IP to the app automatically.

### Smaller ideas

- Timer history view (the `ended` and `cancelled` rows already exist in the database).
- Per-user notifications when a timer fires (needs cloud mode).
- Login rate limiting.

## Known issues

| Issue | Impact | Plan |
|---|---|---|
| Vercel / mobile data can't reach ESP200 | Remote control of ESP200 only works on the home network | Cloud control ([13](13-cloud-control.md)); done for ESP201 |
| Hotspot address range changes every time | ESP200's fixed hotspot IP breaks | ESP201 uses DHCP and reports its IP; do the same for ESP200 |
| ESP201 firmware uses 90 % of flash | Room for little more | Switch to a bigger app partition when adding features |
| ESP200 runs old timer firmware | Can't create timers; basic mode only | Flash `firmware/esp200` |
| Network settings live in `data/network.json` only | On Vercel they reset when the server restarts | Move into the database (or drop: cloud boards don't need them) |
| ESP32 HTTP API has no authentication | Anyone on the same Wi-Fi can switch relays | Acceptable at home; cloud mode adds per-device credentials |
| 6 pre-existing lint errors | None at runtime (setState in effects, one `prefer-const`, one `any`) | Clean up when touching those files |
| Legacy unused components (`Header`, `SummaryCards`, `DeviceGrid`, `RoomFilter`, `SearchBar`) | Dead code | Delete in a cleanup pass |
| Browser can't list devices on the network | An in-app "network terminal" isn't possible | Use the Mac Terminal commands or the ESP32 serial monitor |
