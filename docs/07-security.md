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
| Wi-Fi passwords | `firmware/*/secrets.h` | commit them (the files are git-ignored) |
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
4. **ESP32s have no authentication.** Anyone on the same Wi-Fi can call `/on` or `/off`. Acceptable on a private home network; the cloud (MQTT) mode would add per-device credentials.
5. **Rate limiting** on login isn't implemented.
