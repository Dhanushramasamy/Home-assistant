-- Adds timer configuration columns to the device table.
-- Run once in the Supabase SQL editor. Existing rows and columns are unchanged.
alter table public."device_PRB_home_assistant"
  add column if not exists timer_action text check (timer_action in ('on', 'off')),
  add column if not exists timer_seconds integer check (timer_seconds > 0),
  add column if not exists timer_repeat boolean,
  add column if not exists timer_started_at timestamptz;
