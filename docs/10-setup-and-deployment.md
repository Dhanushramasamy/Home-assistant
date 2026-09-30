# 10 · Setup and deployment

## Run locally

```bash
cd ~/Documents/Personal_files/projects/home-assistant
npm install
npm run dev          # http://localhost:3000
```

Other scripts: `npm run build` (production build), `npm run start` (run the build), `npm run lint`.

To use it from a phone on the same Wi-Fi, open `http://<laptop IP>:3000`. Find the laptop's IP with `ipconfig getifaddr en0`.

## Environment variables

Create `.env.local` in the project root (git-ignored):

| Variable | Required | What |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (after RLS) | Supabase **secret** service-role key (Supabase → Settings → API). Server only |
| `SESSION_SECRET` | yes | Any long random string that signs login cookies. Generate with `openssl rand -base64 48` |
| `CRON_SECRET` | Vercel only | Any long random string. Lets Vercel's daily keep-alive (`vercel.json`) run so Supabase never pauses |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as an older alternative to the publishable key.

Without `SESSION_SECRET`, login returns "Sign-in isn't configured on the server". Without `SUPABASE_SERVICE_ROLE_KEY` and with RLS on, the server can't read users or devices.

## Database setup (Supabase SQL editor, once)

1. `supabase/add_user_role.sql`
2. `supabase/add_device_timer_records.sql`
3. `supabase/add_device_access.sql`
4. Set `SUPABASE_SERVICE_ROLE_KEY` locally **and** on Vercel, and redeploy.
5. `supabase/lock_down_tables.sql`
6. `supabase/add_cloud_boards.sql`, then `node scripts/board-login.mjs <board> --secrets firmware/<board>/secrets.h` for each cloud board

Details: [06 · Database](06-database.md).

## Deploy to Vercel

- Pushing to `main` on GitHub deploys automatically to `prp-home-assistant.vercel.app`.
- In Vercel → Project → Settings → Environment Variables, set **all four** variables above, then redeploy.
- Checked on the live site: login works, and a request without a session returns 401.
- Remember that the Vercel site can't reach the ESP32s on your home network ([08](08-devices-and-network.md#what-can-reach-what)).

## Flash an ESP32

1. Connect the ESP32 by USB.
2. Make sure `firmware/<device>/secrets.h` has the right Wi-Fi names and passwords (copy from `secrets.example.h` on a new computer).
3. Upload with Arduino IDE (Board: ESP32 Dev Module), or with the bundled `arduino-cli` ([09 · Firmware](09-firmware.md#uploading)).
4. Open the Serial Monitor at 115200 baud and note the network and IP.
5. Check `curl http://<IP>/status`.
6. In the app, make sure the device's IP matches (Settings → Devices, or Edit on the tile).

## Add a new relay to the app

1. Admin → **+** → name, room, **relay number**, type, Direct, and the ESP32's IP.
2. Settings → **Users** → switch the device on for anyone who should use it → **Save**.

## Checks before pushing

```bash
npx tsc --noEmit        # types
npm run lint            # 6 errors are pre-existing (setState-in-effect, prefer-const, any), none new
npm run build
```
