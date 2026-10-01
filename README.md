# Home Control

A private smart-home app for switching bedroom lights and fans through ESP32 relay boards, with timers that run on the device, several users with per-device access, and live sync between phones.

- **App:** Next.js 16 + React 19, Supabase, deployed on Vercel (`prp-home-assistant.vercel.app`)
- **Devices:** ESP200 (home bedroom: Light + Fan) and ESP201 (Erode bedroom), firmware in [`firmware/`](firmware/)
- **Cloud control:** ESP201 is switched through Supabase, so it works from any network ([docs](docs/13-cloud-control.md))

## Documentation

Everything about the project, from how it started to what's next, is in **[`docs/`](docs/README.md)**:

1. [Project overview](docs/01-project-overview.md)
2. [Timeline](docs/02-timeline.md)
3. [Architecture](docs/03-architecture.md)
4. [App features](docs/04-app-features.md)
5. [API reference](docs/05-api-reference.md)
6. [Database](docs/06-database.md)
7. [Security](docs/07-security.md)
8. [Devices and network](docs/08-devices-and-network.md)
9. [Firmware](docs/09-firmware.md)
10. [Setup and deployment](docs/10-setup-and-deployment.md)
11. [Troubleshooting](docs/11-troubleshooting.md)
12. [Roadmap and known issues](docs/12-roadmap-and-known-issues.md)
13. [Cloud control](docs/13-cloud-control.md)
14. [Adding a board](docs/14-adding-a-board.md)
15. [Change log (30 Sep – 1 Oct 2026)](docs/15-change-log.md)
16. [Admin guide: add a new ESP32](docs/16-admin-guide.md)

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the four values
npm run dev                  # http://localhost:3000
```

Required environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (plus `CRON_SECRET` on Vercel for the daily keep-alive). Details in [Setup and deployment](docs/10-setup-and-deployment.md).
