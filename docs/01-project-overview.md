# 01 · Project overview

## What it is

Home Control lets the family switch real appliances (bedroom lights and fans) from a phone or laptop. Each room has an **ESP32** microcontroller wired to a **relay module**; the relay sits in the appliance's switch line. The ESP32 runs a small web server (`/on`, `/off`, `/status`, `/timer`, …). The **Home Control app** talks to those ESP32s and adds everything a family needs on top: login, several users, who-can-control-what, timers, live updates on every phone, and a polished mobile UI.

```text
 Phone / laptop browser
        │  (tap "Light ON")
        ▼
 Home Control app  ── Next.js (pages + API routes) ── Supabase (users, devices, timers, access)
        │
        │  HTTP on the local network:  GET http://192.168.1.200/on?relay=1
        ▼
 ESP32 (ESP200) ── GPIO 23 ──► Relay 1 ──► Bedroom light
                └─ GPIO 22 ──► Relay 2 ──► Bedroom fan
```

## Goals

1. Switch lights and fans from a phone, reliably, with the real state always shown (never a guessed ON/OFF).
2. Timers that run **on the ESP32 itself**, so they fire even when no phone is open.
3. Several people (for example Mom) with access only to the devices the admin chooses.
4. Changes made on one phone appear on the others within seconds.
5. Safe by default: relays may switch mains power, so nothing switches unexpectedly, and nobody without a login can control anything.

## Hardware

| Part | Used for | Notes |
|---|---|---|
| ESP32 Dev Module (30-pin) | ESP200 and ESP201 controllers | Wi-Fi web server, port 80 |
| 2-channel relay module (5 V, active LOW) | Switching light and fan | JD-VCC jumper kept on; wired NO/COM in the appliance line |
| Raspberry Pi 5 and Pi 4 | Early prototype, Tailscale remote access, optional "gateway" | Fixed IPs `.100` (Pi 5) and `.101` (Pi 4) on the office network |
| HC-SR04 ultrasonic sensor | Side experiment only | Not part of the current firmware |

See [08 · Devices and network](08-devices-and-network.md) for pins and addresses.

## Devices today

| Device | Location | Relays | Address |
|---|---|---|---|
| **ESP200** | Home bedroom | Relay 1 → Light (GPIO 23), Relay 2 → Fan (GPIO 22) | `192.168.1.200` on `Dhanush-Wifi-2.4G`. Old direct-IP sketch; not on the cloud yet |
| **ESP201** | Erode bedroom | Relay 1 (GPIO 23) | **Cloud board** on the common template (since 2026-10-01). Wi-Fi by priority (Pixel → home → Airtel), address from DHCP (now `192.168.1.131` on Airtel) |

In the app, **each relay is its own tile**: ESP200 appears as two tiles, "Light" (relay 1) and "Fan" (relay 2), which share one IP address.

## People and roles

| User | Role | Can do |
|---|---|---|
| **DhanushRaja** | Admin | Everything: all devices, add/edit/delete devices, network settings, create users, choose each user's devices |
| **Parimala** (Mom), **Raja** | User | Only the devices the admin grants in Settings → Users; switch them, set timers, test connection; change own password |

## Where it runs

- **Locally:** `npm run dev` on the laptop at `http://localhost:3000`. This is the only way that always reaches the ESP32s, because the laptop is on the same Wi-Fi.
- **Vercel:** `https://prp-home-assistant.vercel.app` (functions in Sydney, next to the database). Everything works from any network for **cloud boards** (ESP201), which talk to Supabase ([13](13-cloud-control.md)). Boards without the cloud (ESP200 today) still need the same Wi-Fi.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.6, App Router, `proxy.ts` (the renamed middleware) |
| UI | React 19, Tailwind CSS 4, `motion` 13 (animations), `lucide-react` icons, React Three Fiber + drei (3D lamp and fan) |
| Data | Supabase Postgres via `@supabase/supabase-js` (server-side only) |
| Auth | Custom: server-checked scrypt password hashes + signed httpOnly session cookie |
| Firmware | Arduino C++ for ESP32 (`WebServer`, `WiFi`), compiled with the Arduino IDE / `arduino-cli` |
