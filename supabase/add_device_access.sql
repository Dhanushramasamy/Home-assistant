-- Which devices each (non-admin) user may see and control.
-- Run once in the Supabase SQL editor. Admins always have every device.
create table if not exists public."user_device_access_PRB_home_assistant" (
  username text not null,          -- stored lower-case
  device_id text not null references public."device_PRB_home_assistant" (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (username, device_id)
);

-- Server-only, like the other tables (see lock_down_tables.sql).
alter table public."user_device_access_PRB_home_assistant" enable row level security;
