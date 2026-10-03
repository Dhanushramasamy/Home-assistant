# 12 · Roadmap and known issues

## Do next (in order)

1. **Add `CRON_SECRET` in Vercel** (any long random text) so the daily keep-alive runs and the free Supabase project never pauses.
2. **Upload the latest code to ESP201** (saved timers, restart reason): Settings → Boards → esp201 → Download code → upload by USB.
3. **Power:** a separate 5V supply for the relay modules, and the official Pi 5 power supply. The Pi restarted by itself, and its USB dropped when the ESP32 restarted.
4. **Security clean-up:**
   - change the admin password;
   - change the Pi password;
   - delete the public ChatGPT share link;
   - decide whether the GitHub repo should be private.

## Planned features

### Faster cloud confirmation

- The board's report takes 2–3 s (a new TLS connection each time). Reusing one connection hung on the ESP32 (2026-10-01). Options: retry with a newer ESP32 core or a different HTTP client, or move Supabase and Vercel to Mumbai (shorter trips from India).

### Wi-Fi setup from a phone

- Today, changing a board's Wi-Fi means downloading and uploading its code again. A setup mode (the board opens its own Wi-Fi to pick a network from a phone) would avoid the USB step.

### Over-the-air updates

- Upload new code to an installed board over Wi-Fi instead of USB. Needs a bigger app partition (the sketch uses 90 % of flash).

### Smaller ideas

- Timer history view (the old timer-history table was dropped in the four-table rework).
- Per-user notifications when a timer fires (needs cloud mode).
- Login rate limiting.

## Known issues

| Issue | Impact | Plan |
|---|---|---|
| Board firmware uses 90 % of flash | Room for little more | Bigger app partition when adding features |
| Cloud confirmation takes 2–3 s | The loader spins that long | New TLS connection per report; kept connections hung (see above) |
| Closing the serial port can leave ESP201 in upload mode | Board offline until reset | Press EN/RST; avoid serial loggers on installed boards |
| Network settings live in `data/network.json` only | On Vercel they reset when the server restarts | Move into the database (or drop: cloud boards don't need them) |
| ESP32 HTTP API has no authentication | Anyone on the same Wi-Fi can switch relays | Acceptable at home; cloud mode adds per-device credentials |
| 5 pre-existing lint errors | None at runtime (setState in effects, one `prefer-const`) | Clean up when touching those files |
| Legacy unused components (`Header`, `SummaryCards`, `DeviceGrid`, `RoomFilter`, `SearchBar`) | Dead code | Delete in a cleanup pass |
| Browser can't list devices on the network | An in-app "network terminal" isn't possible | Use the Mac Terminal commands or the ESP32 serial monitor |
