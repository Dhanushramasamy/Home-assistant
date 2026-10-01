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
┌──────────────── Browser (phone / laptop, any network) ───────────────┐
│ app/page.tsx (client component)                                       │
│  • session from GET /api/auth/me                                      │
│  • switches from GET /api/devices, re-read every 3 s                  │
│  • status per switch via /api/devices/status (10 s; ~0.6 s while a     │
│    tap is being confirmed)                                            │
│  • one lock + loader per switch while a tap is in flight              │
└───────────────┬───────────────────────────────────────────────────────┘
                │ fetch /api/*  (cookie: hc_session)
┌───────────────▼──────── Next.js server (Vercel, syd1) ────────────────┐
│ proxy.ts ─ rejects no-session (401) / non-admin (403)                 │
│ route handlers ─ switch access check (403)                            │
│ lib/deviceController ─► cloud board: Supabase (board_set_relay, …)    │
│                      └► board without cloud: HTTP to its IP (LAN only)│
│ lib/*Store ─► Supabase (service-role key)                              │
└──────────────┬────────────────────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────┐
        │ Supabase (Sydney): users, boards,    │
        │ switches, access · RLS · Realtime    │
        └──────▲──────────────────────────────┘
               │ one live connection (WSS) + HTTPS reports, outbound
        ┌──────┴──────┐
        │ ESP32 board │  any Wi-Fi with internet (DHCP)
        └─────────────┘
```

## How a tap reaches a relay (cloud board)

1. **Tap:** the user taps the On/Off pill. The switch moves at once and shows a spinner; more taps on it are ignored.
2. **Server:** `POST /api/devices/control` checks the session and access. `controlViaBoard` calls `board_set_relay`, which sets `desired = {"1":"on"}` on the board's row.
3. **Realtime:** Supabase pushes the row change to the board's open connection (~0.6 s). The board's cloud task queues it, and its main loop switches the relay.
4. **Report:** the board PATCHes its `/status` JSON into `reported` (~2–3 s after the tap).
5. **Confirm:** the page polls `/api/devices/status` until the board's own report shows the new state (`pending: false`), then stops the spinner. Board offline → immediate error; no answer in 10 s → error; different state → the real state plus an error.
6. **Other phones:** they see it on their next 3-second `/api/devices` read.

A board without the cloud (ESP200) is switched by `GET http://<ip>/on?relay=N`, which only works when the server or browser is on its Wi-Fi. On Vercel such taps fail straight away with a clear message.

## How status and timers sync

- **The board is the source of truth.** Its `reported` JSON holds relays, running timers, Wi-Fi, IP, uptime, cloud state and `acks` (command results). Countdowns are moved on by the report's age (`lib/boardStore.ts`).
- **Pending tap:** for 15 s after a tap, until the board reports again, the server counts the asked-for state (`withPending`) so lists don't flick back.
- **Timers:** `board_push_command` adds `{seq, op, …}` to `boards.commands`. The board runs each once and the app waits for its ack ([13](13-cloud-control.md#timers-through-the-cloud)).
- **Online:** the board checked in within 150 s (it checks in every 60 s).

## Device model

A **switch** (a `Device` in the code) is one relay:

```ts
interface Device {
  id: string;            // e.g. "light"
  name: string;          // "Light"
  room: string;          // "Bedroom"
  type: "light" | "fan" | "plug" | "other";
  boardId: string | null;// cloud board, e.g. "esp201"; null = direct IP only
  ip: string;            // the board's reported IP (cloud) or the saved IP
  relay: number;         // 1..8
  powerState: "on" | "off" | "unknown";       // from the board, not stored
  connectionState: "connected" | "offline" | "checking";
}
```

Stored in `switches` (no power column). Several switches can share a board (one per relay).

## Direct mode vs gateway mode

- **Direct** (current): the Next.js server (or the browser) calls the ESP32 itself.
- **Gateway:** requests go to a Raspberry Pi at `gatewayIp:gatewayPort` (`/api/gateway/device`), which forwards to the ESP32. This is supported in code but not used day to day.

## Design system

- Tokens in `app/globals.css`: canvas `#141518`, glass surfaces (`.glass`, `.glass-btn`), ink `#f4f4f5`, accent lime `#e8f047`.
- Fonts: SF Pro on Apple devices, Inter elsewhere.
- Motion: `motion/react` with shared springs in `lib/deviceTheme.ts`; respects the system Reduce Motion setting.
- Background: `public/bg-home.jpg`, blurred, darkened and slowly zooming (`components/ui/Backdrop.tsx`).
