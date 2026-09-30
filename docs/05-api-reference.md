# 05 · API reference

All routes live under `app/api/`. **`proxy.ts` guards every one of them:**

- **Open** (no session needed): `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `OPTIONS`.
- **Signed in**: everything else needs a valid `hc_session` cookie, else **401** `{"error":"Not signed in."}`.
- **Admin only**: listed below, else **403** `{"error":"Administrator access required."}`.
- **Device access**: routes that take a `deviceId` also check the user may use that device, else **403** `{"error":"You don't have access to this device."}`. Admins can use every device.

## Auth

| Method & path | Who | Body / query | Response |
|---|---|---|---|
| `POST /api/auth/login` | anyone | `{username, password}` | `200 {success, username, role}` and sets the cookie · `401 {success:false, message}` · `500` if `SESSION_SECRET` is missing |
| `POST /api/auth/logout` | anyone | — | clears the cookie |
| `GET /api/auth/me` | anyone | — | `200 {authenticated:true, username, role}` · `401 {authenticated:false}` |
| `POST /api/auth/password` | signed in | `{currentPassword, newPassword}` (≥ 6 chars) | `200 {success, message}` · `400` wrong current password |

## Users (admin only)

| Method & path | Body | Response |
|---|---|---|
| `GET /api/users` | — | `{users:[{username, role, deviceIds[]}], storage:"database"\|"local"\|"missing"}` |
| `POST /api/users` | `{username, password, role:"user"\|"admin"}` | `201 {success, message}` · `400` duplicate, short password, or missing role column for admins |
| `PUT /api/users/access` | `{username, deviceIds:[...]}` | `200 {success, message:"Saved."}` · `500` with a setup message if the access table is missing in production |

## Devices

| Method & path | Who | Body / query | Notes |
|---|---|---|---|
| `GET /api/devices` | signed in | — | Devices this user may see (admin: all) |
| `POST /api/devices` | admin | `{name, room, type, mode, ip, relay}` | Add device |
| `GET /api/devices/[id]` | device access | — | One device |
| `PUT /api/devices/[id]` | admin | partial device | Edit |
| `DELETE /api/devices/[id]` | admin | — | Delete (timer records and access rows cascade) |
| `POST /api/devices/control` | device access | `{deviceId, action:"on"\|"off"\|"toggle"}` | Sends `/on` or `/off` `?relay=N` to the ESP32; stores the new state |
| `GET /api/devices/status?deviceId=` | device access | — | Reads the ESP32's `/status`; returns power, this relay's timers, `timerMode`, ssid, rssi, uptime, `savedTimers`; syncs the DB |
| `POST /api/devices/status` | device access | `{deviceId, report:<raw /status JSON>}` | Browser-read status (when the server can't reach the ESP32) applied the same way |
| `POST /api/devices/test` | device access | `{deviceId}` | `HEAD http://<ip>/`; reachable, response time |
| `POST /api/devices/reset` | admin | — | Replace devices with the samples |
| `POST /api/devices/clear` | admin | — | Remove all devices |

### Timers

| Method & path | Body | What the ESP32 receives |
|---|---|---|
| `POST /api/devices/timer` | `{deviceId, action:"on"\|"off", seconds:1–86400, repeat?}` | First `GET /status` to check `timerApi` ≥ 2; then `GET /timer?relay=N&action=…&seconds=…[&repeat=true]`. Refused with `reason:"unsupported"` on basic firmware |
| `POST /api/devices/timer` + `recordOnly:true, espTimerId` | as above | nothing (records a timer the browser already created) |
| `POST /api/devices/timer/cancel` | `{deviceId, timerId}` | `GET /timer/cancel?id=ID` (404 from the ESP32 = already gone → record marked ended) |
| `POST /api/devices/timer/clear` | `{deviceId}` | Full firmware: `GET /timer/cancel?id=…` for each of this relay's timers. Basic firmware: `GET /timer/cancel?relay=N`. **Never `/timers/clear`** |

Timer responses: `{success, deviceId, reachable, created?, timers?, reason?, targetUrl, message}`, where `reason` is `offline | invalid | not_found | limit | unsupported | error`, and `message` is already human-readable ("Maximum of 10 timers are already active on this device.").

## Network and gateway

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/network` | signed in | `{name, subnet, gateway, mode, gatewayIp, gatewayPort, timeoutMs}` |
| `PUT /api/network` | admin | Save network settings (local file) |
| `POST /api/gateway/device` | signed in | Pi-gateway forwarder: `{deviceId, action:"on"\|"off"\|"toggle"\|"status"}`, or `{deviceId, action:"esp", path:"status"\|"timers"\|"timer"\|"timer/cancel", query}` |
| `GET /api/gateway/status` | signed in | Gateway summary |

## Cloud boards

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/boards` | admin | `{boards: [{boardId, name, online, linked, ip, ssid, rssi, lastSeen, desired}]}`; `setupNeeded` if the SQL wasn't run |
| `GET /api/cron/keepalive` | Vercel Cron | Needs `Authorization: Bearer $CRON_SECRET`; one small query daily so Supabase never pauses |

Devices with a `boardId` use the same `/api/devices/control`, `/status` and `/test` routes; the server switches them through the board ([13](13-cloud-control.md)). `modeUsed` / `mode` is then `"cloud"`.

## ESP32 endpoints the app calls

| Endpoint | Used for |
|---|---|
| `GET /on?relay=N`, `GET /off?relay=N` | Switching |
| `GET /status` | Power (`relays[]`), timers, `timerApi`, ssid, rssi, uptime |
| `GET /timers` | Fallback timer list when `/status` has none |
| `GET /timer?relay=N&action=…&seconds=…[&repeat=true]` | Create timer (Timer API v2 only) |
| `GET /timer/cancel?id=ID` / `?relay=N` | Cancel one / cancel a relay's timers |
| `HEAD /` | Connection test |

Full firmware contract: [esp32-timer-firmware.md](esp32-timer-firmware.md).
