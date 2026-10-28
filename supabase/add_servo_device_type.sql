-- Add servo devices as first-class switch records. A servo shares a board with
-- its relay, so relay uniqueness applies only to relay-backed device types.
alter table public.switches
  drop constraint if exists switches_board_id_relay_key;

alter table public.switches
  drop constraint if exists switches_type_check;

alter table public.switches
  add constraint switches_type_check
  check (type in ('light', 'fan', 'plug', 'other', 'servo'));

create unique index if not exists switches_board_relay_unique
  on public.switches (board_id, relay)
  where type <> 'servo';

create unique index if not exists switches_board_servo_unique
  on public.switches (board_id)
  where type = 'servo';
