# 03 · Architecture

## Folder structure

```text
home-assistant/
├── app/
│   ├── layout.tsx              Root layout, fonts (SF Pro / Inter), metadata, favicon
│   ├── page.tsx                The whole client app: session, devices, live sync, timers, grid, nav
│   ├── globals.css             Theme tokens (charcoal glass), glass classes, animations
│   └── api/                    Server routes (see 05-api-reference.md)
│       ├── auth/               login · logout · me · password
│       ├── users/              list/create users · access (per-user devices)
│       ├── devices/            list/add · [id] · control · status · test · timer · timer/cancel · timer/clear · reset · clear
│       ├── network/            network settings
│       └── gateway/            Pi-gateway forwarding (device · status)
├── proxy.ts                    Guards every /api route with the session cookie (Next 16 "proxy" = old middleware)
├── components/
│   ├── DeviceCard.tsx          One relay tile: icon, ↗ arrow, room, name, timer chip, On/Off pill
│   ├── Device3DModal.tsx       Device screen: power, 3D model, status tiles, IP + Test, timers
│   ├── LoginPage.tsx, LoginModal.tsx
│   ├── AddDeviceModal.tsx, EditDeviceModal.tsx, DeviceFormParts.tsx
│   ├── ConnectionTestModal.tsx, ToastContainer.tsx
│   ├── 3d/                     LampCanvas, FanCanvas, Dynamic3DCanvas (React Three Fiber)
│   ├── settings/               SettingsView + Account, General, Users, Network, Devices, Controller, Advanced, Group
│   ├── ui/                     Backdrop, Button, ModalShell, PowerPill, RollingNumber, Switch
│   └── (Header, SummaryCards, DeviceGrid, RoomFilter, SearchBar — legacy, unused)
├── lib/
│   ├── deviceController.ts     Talks to ESP32s (direct or via gateway): ON/OFF, status, timers, test
│   ├── deviceStore.ts          Devices + timer records (Supabase, local-file fallback)
│   ├── accessStore.ts          Per-user device access (Supabase)
│   ├── userStore.ts            Users: login, create, change password (server only)
│   ├── networkStore.ts         Network settings (local file)
│   ├── supabaseClient.ts       Server Supabase client (service-role key when set)
│   ├── auth/                   password.ts (scrypt) · session.ts (signed cookie) · requestSession.ts (route helpers)
│   ├── authClient.ts           Browser sign-in call
│   ├── timerClient.ts          Browser timer/status calls with direct-to-ESP32 fallback, countdown helpers
│   ├── timerParse.ts           Parses ESP32 timer JSON, detects firmware timer mode, error messages
│   ├── sound.ts                Switch click (Web Audio) + haptics
│   ├── useBackClose.ts         Android/browser back closes the top layer
│   ├── useNow.ts               1-second tick for countdowns
│   ├── deviceTheme.ts          Accent colours, springs, easing
│   └── networkUtils.ts         IP/subnet helpers
├── types/device.ts             Device, timer, status and response types
├── supabase/                   SQL migrations (see 06-database.md)
├── firmware/                   ESP32 sketches (see 09-firmware.md)
├── data/                       Local fallback files (devices.json, network.json, device-access.json)
├── public/                     appicon.png, bg-home.jpg (background photo)
└── docs/                       This documentation
```

## Runtime pieces

```text
┌──────────────── Browser (phone / laptop) ────────────────┐
│ app/page.tsx (client component)                          │
│  • session from GET /api/auth/me                         │
│  • devices from GET /api/devices, re-read every 3 s      │
│  • ESP32 status via /api/devices/status (10 s / device)  │
│  • fallback: direct GET http://<ESP32>/... from browser  │
└───────────────┬──────────────────────────────────────────┘
                │ fetch /api/*  (cookie: hc_session)
┌───────────────▼──────────── Next.js server ──────────────┐
│ proxy.ts ─ rejects no-session (401) / non-admin (403)    │
│ route handlers ─ device access check (403)               │
│ lib/deviceController ─► ESP32 over HTTP (LAN)            │
│ lib/*Store ─► Supabase (service-role key)                │
└──────────────┬──────────────────────────┬────────────────┘
               │                          │
        ┌──────▼──────┐            ┌──────▼──────────────────┐
        │ ESP32 (LAN) │            │ Supabase Postgres (RLS) │
        └─────────────┘            └─────────────────────────┘
```

## How a tap reaches a relay

1. The user taps the On/Off pill on the **Light** tile. `PowerPill` plays the click sound and haptic, then calls `handleTogglePower` in `app/page.tsx`.
2. **Optimistic UI:** the tile switches immediately. The device is marked "just changed" for 5 s, so live sync doesn't flip it back before the server catches up.
3. The browser fires `GET http://192.168.1.200/on?relay=1` directly (no-cors). This works when the page is served over `http` on the same network.
4. It also calls `POST /api/devices/control {deviceId, action:"on"}`. `proxy.ts` checks the session; the route checks the user may use this device; `executeDeviceControl` sends `GET http://<ip>/on?relay=<relay>` (or forwards through the Pi gateway) and stores the new state in Supabase.
5. About 0.8 s later the page re-reads `/api/devices/status`. The ESP32's `/status` → `relays[]` is the truth for that relay's power.
6. **Other phones** pick up the change on their next 3-second `/api/devices` read.

## How status and timers sync

- **ESP32 is the source of truth** for power and running timers. The database only remembers what was set (for history, and for the "saved · offline" view).
- `getDeviceStatus` → `GET /status` on the ESP32. Two tiles on the same ESP32 share one request (2-second de-dup). Then `applyDeviceReport`:
  1. picks this tile's relay power from `relays[]`;
  2. keeps only this relay's timers;
  3. detects the firmware timer mode (`timerApi` ≥ 2 = "full", else "basic");
  4. reconciles timer records (full mode only): records no longer running are marked `ended`, running timers the DB didn't know are added;
  5. updates the device's power and online state.
- **Countdowns** tick locally every second from the last sync (`remainingNow`) and are corrected at each sync.
- **Sync schedule** (`app/page.tsx`): each device is re-checked every 10 s while online. Offline devices back off: 60 s, then doubling up to 5 min. The device screen re-checks every 15 s while open.

## Device model

A **device** in the app is one relay:

```ts
interface Device {
  id: string;            // e.g. "kitchen-light"
  name: string;          // "Light"
  room: string;          // "Bedroom"
  type: "light" | "fan" | "plug" | "other";
  mode: "direct" | "gateway";
  ip: string;            // "192.168.1.200"
  relay: number;         // 1 or 2
  powerState: "on" | "off" | "unknown";
  connectionState: "connected" | "offline" | "checking";
  timers?: DeviceTimerConfig[];   // saved timer records
}
```

ESP200 is therefore two devices with the same `ip` and `relay` 1 / 2.

## Direct mode vs gateway mode

- **Direct** (current): the Next.js server (or the browser) calls the ESP32 itself.
- **Gateway:** requests go to a Raspberry Pi at `gatewayIp:gatewayPort` (`/api/gateway/device`), which forwards to the ESP32. This is supported in code but not used day to day.

## Design system

- Tokens in `app/globals.css`: canvas `#141518`, glass surfaces (`.glass`, `.glass-btn`), ink `#f4f4f5`, accent lime `#e8f047`.
- Fonts: SF Pro on Apple devices, Inter elsewhere.
- Motion: `motion/react` with shared springs in `lib/deviceTheme.ts`; respects the system Reduce Motion setting.
- Background: `public/bg-home.jpg`, blurred, darkened and slowly zooming (`components/ui/Backdrop.tsx`).
