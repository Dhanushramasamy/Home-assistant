-- Per-servo switch target and software movement speed.
alter table public.switches
  add column if not exists servo_on_angle smallint not null default 90
    check (servo_on_angle between 0 and 180),
  add column if not exists servo_off_angle smallint not null default 180
    check (servo_off_angle between 0 and 180),
  add column if not exists servo_speed_dps smallint not null default 20
    check (servo_speed_dps between 1 and 180);

-- A servo is attached to a board, not a relay output. Keep relay uniqueness
-- for relay-backed devices and allow one servo record per board.
alter table public.switches drop constraint if exists switches_board_id_relay_key;
create unique index if not exists switches_board_relay_unique
  on public.switches (board_id, relay) where type <> 'servo';
create unique index if not exists switches_board_servo_unique
  on public.switches (board_id) where type = 'servo';
