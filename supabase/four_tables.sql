-- The app's database: four tables.
--
--   users     who can sign in
--   boards    each ESP32: live status (reported), what the app wants (desired),
--             timer commands, network, last check-in
--   switches  each light / fan tile: name, room, type, which board + relay
--   access    which user may use which switch (admins use everything)
--
-- Copies everything from the old tables (user_PRB_home_assistant,
-- device_PRB_home_assistant, user_device_access_PRB_home_assistant,
-- esp_board_prb_home_assistant). The old tables are NOT changed or deleted;
-- supabase/drop_old_tables.sql removes them once everything is checked.
--
-- Run once in the Supabase SQL editor. Safe to run again.

-- ------------------------------------------------------------------
-- users
-- ------------------------------------------------------------------
create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,
  password   text not null,                       -- scrypt hash, never plain text
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);
create unique index if not exists users_username_unique on public.users (lower(username));

-- ------------------------------------------------------------------
-- boards
-- ------------------------------------------------------------------
create table if not exists public.boards (
  board_id     text primary key check (board_id ~ '^[a-z0-9-]+$'),
  name         text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  desired      jsonb not null default '{}'::jsonb,  -- {"1":"on"}: relay -> power
  desired_at   timestamptz,
  commands     jsonb not null default '[]'::jsonb,  -- last 10 timer commands
  command_seq  bigint not null default 0,
  reported     jsonb,                               -- the board's /status JSON
  reported_at  timestamptz,
  ip           text,
  ssid         text,
  rssi         integer,
  last_seen    timestamptz,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- switches
-- ------------------------------------------------------------------
create table if not exists public.switches (
  id         text primary key,
  name       text not null,
  room       text not null default 'General',
  type       text not null default 'light' check (type in ('light', 'fan', 'plug', 'other')),
  board_id   text references public.boards (board_id) on update cascade on delete set null,
  relay      integer not null default 1 check (relay between 1 and 16),
  ip         text,                                  -- direct control on the same Wi-Fi
  created_at timestamptz not null default now(),
  unique (board_id, relay)
);

-- ------------------------------------------------------------------
-- access
-- ------------------------------------------------------------------
create table if not exists public.access (
  user_id    uuid not null references public.users (id) on delete cascade,
  switch_id  text not null references public.switches (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, switch_id)
);

-- ------------------------------------------------------------------
-- Copy the current data
-- ------------------------------------------------------------------
insert into public.users (id, username, password, role, created_at)
select id, username, password,
       case when role in ('admin', 'user') then role
            when lower(username) = 'dhanushraja' then 'admin'
            else 'user' end,
       coalesce(created_at, now())
from public."user_PRB_home_assistant"
on conflict do nothing;

insert into public.boards (board_id, name, auth_user_id, desired, desired_at, reported, reported_at, ip, ssid, rssi, last_seen, created_at)
select board_id, name, auth_user_id, desired, desired_at, reported, reported_at, ip, ssid, rssi, last_seen, created_at
from public.esp_board_prb_home_assistant
on conflict do nothing;

insert into public.switches (id, name, room, type, board_id, relay, ip)
select d.id, d.name, coalesce(d.room, 'General'),
       case when d.type in ('light', 'fan', 'plug', 'other') then d.type else 'light' end,
       b.board_id, coalesce(d.relay, 1), d.ip
from public."device_PRB_home_assistant" d
left join public.boards b on b.board_id = d.board_id
on conflict do nothing;

insert into public.access (user_id, switch_id, created_at)
select u.id, a.device_id, a.created_at
from public."user_device_access_PRB_home_assistant" a
join public.users u on lower(u.username) = lower(a.username)
join public.switches s on s.id = a.device_id
on conflict do nothing;

-- ------------------------------------------------------------------
-- Security: only the app's server (service role) reads users, switches
-- and access. Each board reads and updates only its own row.
-- ------------------------------------------------------------------
alter table public.users    enable row level security;
alter table public.boards   enable row level security;
alter table public.switches enable row level security;
alter table public.access   enable row level security;

revoke all on table public.users, public.switches, public.access from anon, authenticated;
revoke all on table public.boards from anon, authenticated;
grant select on table public.boards to authenticated;
grant update (desired, reported, ip, ssid, rssi, last_seen) on table public.boards to authenticated;

drop policy if exists "board reads own row" on public.boards;
create policy "board reads own row" on public.boards
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "board updates own row" on public.boards;
create policy "board updates own row" on public.boards
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- The database's clock sets last_seen / reported_at / desired_at.
create or replace function public.boards_touch() returns trigger
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

drop trigger if exists boards_touch on public.boards;
create trigger boards_touch
  before update on public.boards
  for each row execute function public.boards_touch();

-- Server only: switch one relay without touching the others.
create or replace function public.board_set_relay(p_board text, p_relay integer, p_power text)
returns boolean
language sql as $$
  with changed as (
    update public.boards
       set desired = coalesce(desired, '{}'::jsonb) || jsonb_build_object(p_relay::text, p_power)
     where board_id = p_board
    returning 1
  )
  select exists (select 1 from changed);
$$;

-- Server only: queue a timer command for a board; returns its number
-- (null if there's no such board). Keeps the last 10.
create or replace function public.board_push_command(p_board text, p_command jsonb)
returns bigint
language plpgsql as $$
declare
  v_seq bigint;
begin
  update public.boards
     set command_seq = command_seq + 1,
         commands = coalesce((
           select jsonb_agg(t.c order by (t.c ->> 'seq')::bigint)
           from (
             select c
             from jsonb_array_elements(commands) as c
             order by (c ->> 'seq')::bigint desc
             limit 9
           ) t
         ), '[]'::jsonb)
         || jsonb_build_array(
              p_command || jsonb_build_object('seq', command_seq + 1, 'at', floor(extract(epoch from now()))::bigint)
            )
   where board_id = p_board
  returning command_seq into v_seq;
  return v_seq;
end $$;

revoke all on function public.board_set_relay(text, integer, text) from public, anon, authenticated;
revoke all on function public.board_push_command(text, jsonb) from public, anon, authenticated;
grant execute on function public.board_set_relay(text, integer, text) to service_role;
grant execute on function public.board_push_command(text, jsonb) to service_role;

-- Boards hear about changes to their row the moment they happen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'boards'
  ) then
    alter publication supabase_realtime add table public.boards;
  end if;
end $$;

-- Check: row counts after copying.
select 'users' as "table", count(*) from public.users
union all select 'boards', count(*) from public.boards
union all select 'switches', count(*) from public.switches
union all select 'access', count(*) from public.access;
