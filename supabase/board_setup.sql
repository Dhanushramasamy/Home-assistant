-- Board setup from the app (Settings -> Boards, admin only).
-- Adds what the app needs to generate a board's firmware: its relays and
-- pins, and its Wi-Fi networks in priority order. Wi-Fi passwords and the
-- board's own sign-in password are stored encrypted by the app's server.
--
-- Run once in the Supabase SQL editor after four_tables.sql. Safe to run again.

alter table public.boards
  add column if not exists relay_pins jsonb not null default '[23]'::jsonb,       -- ESP32 pin per relay, relay 1 first
  add column if not exists relay_active_low boolean not null default true,         -- most relay modules switch on LOW
  add column if not exists wifi jsonb not null default '[]'::jsonb,                -- [{ssid, priority, password: encrypted}]
  add column if not exists secret text;                                             -- encrypted board sign-in password

-- A board can read its own row, including these columns, but the Wi-Fi and
-- sign-in passwords are encrypted with a key only the app's server has.
