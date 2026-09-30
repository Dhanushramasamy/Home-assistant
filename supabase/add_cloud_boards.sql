-- Cloud control: ESP32 boards talk to Supabase instead of the app reaching
-- their IP address, so the app works from any network.
--
-- One row per ESP32 board:
--   desired   what the app wants, e.g. {"1":"on","2":"off"} (relay -> power)
--   reported  the board's own /status JSON (relays, timers, ip, ssid, rssi)
--   last_seen set by the database every time the board checks in
--
-- Each board signs in with its own Supabase Auth user (auth_user_id) and can
-- only read and update its own row. The app's server uses the service-role
-- key as before. Run once in the Supabase SQL editor; safe to run again.

create table if not exists public.esp_board_prb_home_assistant (
  board_id     text primary key,
  name         text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  desired      jsonb not null default '{}'::jsonb,
  desired_at   timestamptz,
  reported     jsonb,
  reported_at  timestamptz,
  ip           text,
  ssid         text,
  rssi         integer,
  last_seen    timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.esp_board_prb_home_assistant enable row level security;

-- Which board a device (one relay) belongs to. Empty = direct IP only.
alter table public."device_PRB_home_assistant" add column if not exists board_id text;

-- Boards: read own row; update only the columns they report.
revoke all on table public.esp_board_prb_home_assistant from anon, authenticated;
grant select on table public.esp_board_prb_home_assistant to authenticated;
grant update (desired, desired_at, reported, ip, ssid, rssi, last_seen)
  on table public.esp_board_prb_home_assistant to authenticated;

drop policy if exists "board reads own row" on public.esp_board_prb_home_assistant;
create policy "board reads own row" on public.esp_board_prb_home_assistant
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "board updates own row" on public.esp_board_prb_home_assistant;
create policy "board updates own row" on public.esp_board_prb_home_assistant
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- The database, not the board's clock, decides when it was last seen.
create or replace function public.esp_board_touch() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    new.last_seen := now();
    if new.reported is distinct from old.reported then
      new.reported_at := now();
    end if;
  end if;
  if new.desired is distinct from old.desired then
    new.desired_at := now();
  end if;
  return new;
end $$;

drop trigger if exists esp_board_touch on public.esp_board_prb_home_assistant;
create trigger esp_board_touch
  before update on public.esp_board_prb_home_assistant
  for each row execute function public.esp_board_touch();

-- Server only: switch one relay without overwriting the others.
create or replace function public.set_board_relay(p_board text, p_relay integer, p_power text)
returns boolean
language sql as $$
  with changed as (
    update public.esp_board_prb_home_assistant
       set desired = coalesce(desired, '{}'::jsonb) || jsonb_build_object(p_relay::text, p_power)
     where board_id = p_board
    returning 1
  )
  select exists (select 1 from changed);
$$;

revoke all on function public.set_board_relay(text, integer, text) from public, anon, authenticated;
grant execute on function public.set_board_relay(text, integer, text) to service_role;

-- Boards get told about changes to their row the moment they happen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'esp_board_prb_home_assistant'
  ) then
    alter publication supabase_realtime add table public.esp_board_prb_home_assistant;
  end if;
end $$;

-- First board.
insert into public.esp_board_prb_home_assistant (board_id, name)
values ('esp201', 'ESP201 · Erode bedroom')
on conflict (board_id) do nothing;
