-- Multi-timer support: one row per timer, linked to a device.
-- Run once in the Supabase SQL editor, after (or instead of) add_device_timer.sql.
-- Nothing existing is dropped.
--
-- A row records what the user asked for and the id the ESP32 gave it.
-- The ESP32 /status response stays the source of truth for what is running:
--   scheduled  = created on the ESP32 and not yet known to have ended
--   cancelled  = cancelled from the app
--   ended      = the ESP32 no longer reports it (fired, reboot, removed elsewhere)

create table if not exists public."device_timer_PRB_home_assistant" (
  id uuid primary key default gen_random_uuid(),
  device_id text not null references public."device_PRB_home_assistant" (id) on delete cascade,
  esp_timer_id integer,
  action text not null check (action in ('on', 'off')),
  seconds integer not null check (seconds between 1 and 86400),
  repeat boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_timer_prb_device_status_idx
  on public."device_timer_PRB_home_assistant" (device_id, status);

-- Keep any timer saved by the earlier single-timer columns (if they exist).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'device_PRB_home_assistant' and column_name = 'timer_action'
  ) then
    insert into public."device_timer_PRB_home_assistant" (device_id, action, seconds, repeat, status, created_at)
    select id, timer_action, timer_seconds, coalesce(timer_repeat, false), 'ended', coalesce(timer_started_at, now())
    from public."device_PRB_home_assistant"
    where timer_action in ('on', 'off') and timer_seconds between 1 and 86400;
  end if;
end $$;
