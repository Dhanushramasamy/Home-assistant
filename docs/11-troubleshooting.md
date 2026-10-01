# 11 · Troubleshooting

## Devices

| Symptom | Likely cause | Fix |
|---|---|---|
| Tile shows **"—"** and a red dot | The app can't reach the ESP32 | Check you're on the same Wi-Fi as the ESP32 and opened the app over `http://` (not the Vercel site); `curl http://<IP>/status` |
| Works at home, not on mobile data or the Vercel site | Local addresses can't be reached from the internet | Expected. Use the app on the home network, or build cloud (MQTT) mode |
| ESP32 "connected" on the hotspot but unreachable; ping fails | Hotspot picked a new address range; the ESP32 uses a fixed address from an older range | DHCP-then-`.201` firmware change ([08](08-devices-and-network.md#the-phone-hotspot-problem)); update the IP in the app |
| Relay clicks but the app shows the old state | The board's report hasn't arrived | The loader waits for it (2–3 s); if it errors, check the board in Settings → Boards |
| Error "can't reach your home Wi-Fi directly" | A board without the cloud (ESP200) opened from the live site | Use it on its own Wi-Fi, or move it to the cloud ([16](16-admin-guide.md)) |
| Both tiles switch the same relay | Two tiles with the same IP and relay number | Edit one tile to relay 2 (ESP200: Light = 1, Fan = 2) |

## Cloud boards

| Symptom | Likely cause | Fix |
|---|---|---|
| Board offline in Settings → Boards | No power, no Wi-Fi, or the Wi-Fi has no internet | `http://<IP>/status` on the same Wi-Fi: `"cloud"` shows `no wifi`, `sign-in failed`, `join refused` or `online` |
| Board offline right after a serial monitor / logger was closed | Closing the port left it in upload mode | Press **EN/RST** once |
| `"cloud":"sign-in failed"` | Board password changed or the key changed | Settings → Boards → the board → **Download code** → upload again |
| "Enter the password for X again" when downloading | Saved passwords can't be decrypted (key changed) | Type the Wi-Fi passwords again, Save, download |
| Tap works but the tile flips back after ~15 s | The board switched but its report failed | Check the board's check-ins; see `"cloud"` in `/status` |
| "Cloud boards aren't set up yet" | `four_tables.sql` not run | Run it in the SQL editor |
| Timer: "hasn't confirmed yet" | The board got it but its report is slow or failed | Wait a few seconds and reopen; check `"acks"` in `/status` |
| Pi upload: "port is busy" | Arduino Serial Monitor open on the Pi | Close it, then upload |
| App slow, taps take several seconds | Server far from the database | Keep `vercel.json` `regions` = `syd1` (database is in Sydney) |
| Board answers ping but not `/status`, check-ins stop | Old firmware: cloud work blocked the main loop | Flash the current `firmware/esp201` (cloud work runs on its own core) |
| Serial log on the Pi | Opening the USB port restarts the board | Expected with this board's auto-reset; read the boot log |
| Board joins no Wi-Fi after flashing | Wrong Wi-Fi password in `secrets.h` | Compare with the working sketch; ESP201's Airtel password was wrong in the imported copy (fixed 2026-09-30) |

## Timers

| Symptom | Likely cause | Fix |
|---|---|---|
| "New timers need a firmware update" | The board's firmware has no `timerApi: 2` (ESP200 today) | Flash `firmware/esp200` |
| Timers set on the device don't appear | Old firmware timers lack ids (fixed in `f69e086`), or the device is offline | Update the app; check `/status` |
| "Maximum of 10 timers are already active" | 10 timers running on that ESP32 | Cancel one |
| Timer disappeared after a power cut | The ESP32 loses timers on reboot (by design) | Set it again; the app shows it as no longer running |
| All timers vanished at once | `/timers/clear` was called (old firmware ignores `?relay`) | The app never calls it; don't use it manually |

## Login and users

| Symptom | Likely cause | Fix |
|---|---|---|
| "Sign-in isn't configured on the server" | `SESSION_SECRET` missing | Add it to `.env.local` / Vercel, then redeploy |
| Everyone gets "Invalid username or password" on one server | RLS is on but `SUPABASE_SERVICE_ROLE_KEY` is missing there | Add the key and redeploy |
| A user's switches won't save | `access` table missing | Run `supabase/four_tables.sql`, grant again, tap **Save** (it confirms by reading back) |
| A user sees an empty home | No devices granted (the default) | Settings → Users → switch devices on → Save |

## Sync between phones

| Symptom | Fix |
|---|---|
| The other phone doesn't update | It re-reads every 3 s while the app is open and visible; bring it to the front. Check both are signed in |
| A switch flips back briefly | The server hadn't caught up yet; the 5-second hold should prevent it, so report it if it keeps happening |

## Sound and haptics

| Symptom | Fix |
|---|---|
| No click on iPhone | The side silent switch mutes web audio; the haptic still works |
| No haptic on iPhone | Needs iOS 18+ |
| No haptic on Android | Check the phone's vibration / touch feedback settings |

## Useful commands

```bash
curl http://192.168.1.200/status                 # ESP200 state, relays, timers, timerApi
curl -I http://192.168.1.200/                    # is it up?
ipconfig getifaddr en0                           # this Mac's IP -> network range
route -n get default | grep gateway              # router / hotspot gateway
arp -an | grep "192.168.1\."                     # devices this Mac has seen
```
