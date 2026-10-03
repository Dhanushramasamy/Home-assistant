# 08 · Devices and network

## Devices

### ESP200 — home bedroom

| | |
|---|---|
| Relay 1 | GPIO **23** → Light |
| Relay 2 | GPIO **22** → Fan |
| Relay module | 5 V, active LOW |
| Firmware | Common template (`firmware/template`), set up as board `esp200`, flashed from the Pi on 2026-10-03 (chip ESP32-D0WD, MAC `b8:d6:1a:14:5c:04`) |
| Wi-Fi priority | 1. Home `Dhanush-Wifi-2.4G` · 2. `Dhanush's Pixel` hotspot · 3. Airtel office `Airtel_kaly_5220`, all DHCP |
| Current address | `192.168.1.13` at home (from DHCP; shown in Settings → Boards). It used to be the fixed `192.168.1.200` |
| Control | Cloud: from any network through Supabase ([13](13-cloud-control.md)) |

### ESP201 — Erode bedroom

| | |
|---|---|
| Relay 1 | GPIO **23** |
| Firmware | Common template (`firmware/template`), set up in Settings → Boards, flashed from the Pi on 2026-10-01 |
| Wi-Fi priority | 1. `Dhanush's Pixel` hotspot · 2. Home `Dhanush-Wifi-2.4G` · 3. Airtel office `Airtel_kaly_5220`, all DHCP (no static IP) |
| Current address | `192.168.1.131` on Airtel (from DHCP; shown in Settings → Boards) |
| Control | Cloud: from any network through Supabase ([13](13-cloud-control.md)) |

### Other devices on the office network (Airtel `192.168.1.x`)

| Device | IP |
|---|---|
| Raspberry Pi 5 | **`192.168.1.100`** at the office (`Airtel_kaly_5220`) and at home (`Dhanush-Wifi-5g`), fixed per Wi-Fi in NetworkManager; automatic (DHCP) on the Pixel hotspot |
| Raspberry Pi 4 | `192.168.1.101` |
| ESP201 | `.131` (DHCP, may change) |

## What can reach what

The ESP32 answers only on its **local network**. Whether the app can control it depends on where the app is opened:

| App opened from | Reaches ESP200 at `192.168.1.200`? | Why |
|---|---|---|
| Laptop on home Wi-Fi, `http://localhost:3000` | ✅ yes | Server and browser are on the same network |
| Phone on home Wi-Fi, `http://<laptop-ip>:3000` | ✅ yes | Same network, plain `http` |
| Vercel site (`https://…vercel.app`) | ❌ no | The cloud server isn't in your home; the browser blocks `http://` calls from an `https://` page |
| Phone on mobile data | ❌ no | `192.168.x.x` addresses only exist inside a home network |
| Device on the Pixel hotspot while the ESP32 is on home Wi-Fi | ❌ no | Different networks |

This table is about **boards without the cloud** (none since 2026-10-03). A **cloud board** (ESP200, ESP201) is switched from any of these, including the Vercel site and mobile data, because it keeps its own outbound connection to Supabase ([13](13-cloud-control.md)).

## The phone-hotspot problem

**Symptom:** the ESP32 shows "connected" on the hotspot, but the Mac (on the same hotspot) can't ping it, and the app can't reach it.

**Cause:** Android picks a **new random address range each time the hotspot starts**. That avoids clashes with other networks and is a privacy measure, and it can't be turned off. Ranges seen so far:

| When | Hotspot range | Gateway |
|---|---|---|
| Earlier | `10.196.10.x` | `10.196.10.202` |
| Earlier | `10.198.10.x` | — |
| 2026-09-29 | `10.233.105.x` | `10.233.105.95` |

A fixed ESP32 address like `10.196.10.201` or `10.198.10.2` only works on days the range happens to match. We confirmed it: on `10.233.105.x`, only the phone and the Mac were present, and nothing answered.

**Fix (firmware):** on the Pixel network, get an address by DHCP, read today's range from the gateway, then switch to `<first three numbers>.201` (`.200` for ESP200). The code is in [`firmware/README.md`](../firmware/README.md#phone-hotspot-fixed-201-on-a-changing-network).

**Remaining app problem:** the app stores one IP per device, so on a new hotspot range the IP must be updated. Options on the roadmap:
1. An admin "Network prefix" box: type today's first three numbers and tap Apply.
2. The ESP32 reports its current IP to the app.
3. Cloud (MQTT) mode, where IP addresses don't matter.

**Finding today's range from a Mac on the hotspot:**

```bash
ipconfig getifaddr en0                 # e.g. 10.233.105.112  -> range 10.233.105
route -n get default | grep gateway    # e.g. 10.233.105.95
```

Browsers can't scan the network or list connected devices, so an in-app "network terminal" isn't possible. Use the commands above, or the ESP32's serial monitor.

## Remote access history

- **Tailscale** on the Pi worked for the phone (the phone needs Tailscale installed).
- Public static IP / port forwarding: not pursued, because of CGNAT and security.
- Firebase Realtime Database (seen in a tutorial) was considered; the tutorial's ESP32 polls, and a stream is better.
- **Chosen and built (2026-09-30):** Supabase Realtime, which the app already used. The ESP32 keeps one outbound connection open, so it works on any Wi-Fi with internet and no IPs are involved ([13](13-cloud-control.md)).
