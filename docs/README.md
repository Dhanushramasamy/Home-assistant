# Home Control — Project Documentation

Home Control is a private smart-home app for switching bedroom lights and fans through ESP32 relay boards, from a phone or computer, with timers, several users and live sync between phones.

This folder documents the whole project end to end: how it started, what exists today, how every part works, and what's left to do.

## Start here

| Doc | What's in it |
|---|---|
| [01 · Project overview](01-project-overview.md) | What the system is, the hardware, the people who use it, and the big picture |
| [02 · Timeline](02-timeline.md) | Everything we did, in order: hardware on the Pi, the ESP32s, the app, each redesign and feature |
| [03 · Architecture](03-architecture.md) | How the app is built: Next.js, folders, data flow, how a tap reaches a relay |
| [04 · App features](04-app-features.md) | Every screen and feature: tiles, device screen, timers, settings, users, live sync, sound, back gesture |
| [05 · API reference](05-api-reference.md) | Every API route: who can call it, request and response |
| [06 · Database](06-database.md) | Supabase tables, the SQL files, row-level security, local fallbacks |
| [07 · Security](07-security.md) | Login, password hashing, sessions, access control, secrets, open actions |
| [08 · Devices and network](08-devices-and-network.md) | ESP200 / ESP201, IP addresses, Wi-Fi, the phone-hotspot problem, what can reach what |
| [09 · Firmware](09-firmware.md) | The ESP32 sketches, how to change and upload them, the firmware ↔ app contract |
| [10 · Setup and deployment](10-setup-and-deployment.md) | Running locally, environment variables, SQL order, Vercel, flashing an ESP32 |
| [11 · Troubleshooting](11-troubleshooting.md) | Symptoms, causes and fixes for everything we've hit so far |
| [12 · Roadmap and known issues](12-roadmap-and-known-issues.md) | What isn't done yet and what to build next |
| [13 · Cloud control](13-cloud-control.md) | Switching from any network through Supabase: boards table, security, firmware, adding a board |

## Reference documents

| Doc | What's in it |
|---|---|
| [esp32-timer-firmware.md](esp32-timer-firmware.md) | Full Timer API v2 specification, with test plan and ChatGPT prompt |
| [esp32-history.md](esp32-history.md) | Summary of the original ChatGPT conversation (Pi → ESP32 → static IPs → timers) |
| [../firmware/README.md](../firmware/README.md) | How to upload the ESP32 sketches |
| `private/chatgpt-esp32-chat.md` | Full 442-message ChatGPT transcript. **Local only, git-ignored**, because it contains Wi-Fi passwords |

## Quick facts

| | |
|---|---|
| App | Next.js 16.3.6 (App Router) + React 19, Tailwind CSS 4, `motion`, React Three Fiber |
| Database | Supabase (Postgres) |
| Hosting | Vercel: `prp-home-assistant.vercel.app` · local dev: `npm run dev` on port 3000 |
| Repository | `github.com/Dhanushramasamy/Home-assistant`, branch `main` |
| Devices | **ESP200** (home bedroom, Light + Fan, `192.168.1.200`) · **ESP201** (Erode bedroom, one relay) |
| Users | Admin **DhanushRaja**; users **Parimala**, **Raja** (each sees only the devices the admin grants) |
