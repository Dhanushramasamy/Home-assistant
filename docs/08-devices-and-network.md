# 08 · Devices and network

## Devices

### ESP200 — home bedroom

| | |
|---|---|
| Board | ESP32 Dev Module |
| Relay 1 | GPIO **23** → **Light** (app tile "Light", device id `kitchen-light`) |
| Relay 2 | GPIO **22** → **Fan** (app tile "Fan", device id `home-fan-1`) |
| Relay logic | active LOW (`RELAY_ON LOW`) |
| Wi-Fi | `Dhanush-Wifi-2.4G` (home) |
| IP | fixed **192.168.1.200**, gateway `192.168.1.1`, subnet `255.255.255.0`, DNS `192.168.1.1` / `8.8.8.8` |
| HTTP | port 80 |
| Firmware on the board | **older** than `firmware/esp200/`: no `timerApi`, timers without ids (basic timer mode in the app) |

### ESP201 — Erode bedroom

| | |
|---|---|
| Relay 1 | GPIO **23** |
| Wi-Fi priority | 1. Pixel hotspot → fixed `…201` · 2. Home `Dhanush-Wifi-2.4G` → DHCP · 3. Airtel office `Airtel_kaly_5220` → fixed `192.168.1.201` |
| Hotspot values in the sketch | `10.196.10.201`, gateway `10.196.10.202` (these break when the hotspot range changes; see below) |

### Other devices on the office network (Airtel `192.168.1.x`)

| Device | IP |
|---|---|
| Raspberry Pi 5 | `192.168.1.100` (also the default "gateway" IP in the app) |
| Raspberry Pi 4 | `192.168.1.101` |
| ESP200 / ESP201 | `.200` / `.201` |

## What can reach what

The ESP32 answers only on its **local network**. Whether the app can control it depends on where the app is opened:

| App opened from | Reaches ESP200 at `192.168.1.200`? | Why |
|---|---|---|
| Laptop on home Wi-Fi, `http://localhost:3000` | ✅ yes | Server and browser are on the same network |
| Phone on home Wi-Fi, `http://<laptop-ip>:3000` | ✅ yes | Same network, plain `http` |
| Vercel site (`https://…vercel.app`) | ❌ no | The cloud server isn't in your home; the browser blocks `http://` calls from an `https://` page |
| Phone on mobile data | ❌ no | `192.168.x.x` addresses only exist inside a home network |
| Device on the Pixel hotspot while the ESP32 is on home Wi-Fi | ❌ no | Different networks |

The Vercel site still does login, users, access, saved data and live sync. It just can't switch the relays. Controlling from anywhere needs the **cloud (MQTT) mode** on the [roadmap](12-roadmap-and-known-issues.md).

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
- **Recommended:** cloud MQTT broker (e.g. HiveMQ Cloud free tier). The ESP32 keeps an outbound connection open, and the app sends commands through the broker. This works on any Wi-Fi or mobile data, with no IPs involved.
