# 07 · Security

The relays may switch mains power, so the app treats "who can switch what" seriously.

## What was wrong before (fixed in `3f4e466`)

1. **Plain-text passwords**, read by the browser. The page downloaded the user's row, password included, and compared it in the browser. With the public key, anyone could read every username and password.
2. **Editable sessions.** "Logged in" was a `localStorage` entry. Changing `role` to `admin` in the browser made anyone an admin.
3. **Open API.** Device control and settings routes had no login check.
4. **Hard-coded admin password** in the code, with a fallback that accepted it when the database was down.

## How it works now

| Layer | What |
|---|---|
| **Password storage** | `lib/auth/password.ts`: salted **scrypt** (N=16384, 64-byte key), `scrypt$N$salt$hash`. Existing plain-text passwords were converted (all three accounts are hashed). Login also converts any leftover plain text on first sign-in |
| **Login** | `POST /api/auth/login` checks on the server (`lib/userStore.ts`). The browser only sends username and password and never sees any stored value |
| **Session** | `lib/auth/session.ts`: `hc_session` cookie = base64url payload `{username, role, exp}` + HMAC-SHA256 signature with `SESSION_SECRET`. **httpOnly** (JavaScript can't read it), `secure` in production, `sameSite=lax`, 30 days. Forged or edited cookies fail verification |
| **Route guard** | `proxy.ts` (Next 16's middleware) runs before every `/api` route: no valid session → 401; admin-only paths → 403 for users |
| **Device access** | `lib/auth/requestSession.ts` → `denyDeviceAccess`: status, control, test, timer and single-device routes check the user was granted that device (`lib/accessStore.ts`); `GET /api/devices` returns only granted devices |
| **Database** | RLS on every table, no public policies; the server uses the service-role key (see [06 · Database](06-database.md)) |
| **UI** | Admin-only controls (Settings, Add, Edit, Delete) are hidden for users. This is cosmetic only: the server enforces all of it |

**Admin-only** (from `proxy.ts`): `/api/users/*`, `/api/devices/reset`, `/api/devices/clear`, `PUT /api/network`, `POST /api/devices` (add), and `PUT`/`DELETE /api/devices/[id]`.

## Secrets

| Secret | Where | Never |
|---|---|---|
| `SESSION_SECRET` | `.env.local` and Vercel env | commit it |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` and Vercel env (server only, no `NEXT_PUBLIC_`) | expose it to the browser or commit it |
| Wi-Fi passwords | `boards.wifi` (encrypted), and the generated `board_config.h` in each board's download; old sketches: `firmware/*/secrets.h` | commit them, or share a board's download |
| Board sign-in passwords | `boards.secret` (encrypted); Supabase Authentication holds the user | — |
| `BOARD_SECRET_KEY` (optional) | Vercel env; without it `SESSION_SECRET` is used to derive the AES-256-GCM key (`lib/secretBox.ts`) | change it without re-entering Wi-Fi passwords (old values become unreadable) |
| `CRON_SECRET` | Vercel env | — (lets only Vercel Cron call `/api/cron/keepalive`) |
| Full ChatGPT transcript | `docs/private/` | commit it (git-ignored) |

`.env*`, `firmware/**/secrets.h`, `docs/private/` and `data/device-access.json` are all in `.gitignore`.

## Verified tests

- No cookie → `/api/devices` returns **401**. A forged cookie also returns **401**.
- A user reading or switching a device they weren't given → **403**. A user creating users → **403**.
- Wrong password → 401 with a generic message (no hint whether the username exists).
- Change password: the old password stops working and the new one works.
- The public key can't read the access table, or the others after lock-down.

## Open actions

1. **Change the admin password** (Settings → General → Change Password). The old default is visible in the git history.
2. **Delete the public ChatGPT share link.** It contains Wi-Fi passwords: ChatGPT → Settings → Data controls → Shared links.
3. **Supabase publishable key** is hard-coded as a fallback in `lib/supabaseClient.ts`. It's a public key by design and, with RLS on, can read nothing, but it can be removed once env vars are set everywhere.
4. **ESP32s' local HTTP API has no authentication.** Anyone on the same Wi-Fi can call `/on` or `/off`. Cloud control is authenticated: each board has its own Supabase login and can touch only its own `boards` row (tested: `users` → permission denied; changing its name → 403).
5. **Rate limiting** on login isn't implemented.
6. **The GitHub repo is public.** Docs mention usernames, Wi-Fi network names and local IPs (no passwords; checked before each push). Make the repo private if that matters. The illustrated guide PDF is kept in git-ignored `docs/private/guide/`.
7. **Pi password:** it was shared in chat; change it (`passwd` on the Pi). SSH uses a key, so nothing breaks.
