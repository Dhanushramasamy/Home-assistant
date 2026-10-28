-- Optional PWM signal pin for a hobby servo on a cloud-controlled board.
-- Safe to run more than once.
alter table public.boards
  add column if not exists servo_pin integer;
