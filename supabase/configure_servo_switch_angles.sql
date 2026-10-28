-- Store independent ON and OFF targets for the servo switch.
alter table public.switches
  add column if not exists servo_off_angle smallint not null default 180;

alter table public.switches
  drop constraint if exists switches_servo_on_angle_check,
  drop constraint if exists switches_servo_off_angle_check;

alter table public.switches
  add constraint switches_servo_on_angle_check
    check (servo_on_angle between 0 and 180),
  add constraint switches_servo_off_angle_check
    check (servo_off_angle between 0 and 180);
