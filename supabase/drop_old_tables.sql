-- Removes the app's old tables after the move to four_tables.sql.
-- Run ONLY after the app and every board work on the new tables.
-- This cannot be undone. The Linear tables (linear_*) are a different
-- project and are not touched.

drop table if exists public."device_timer_PRB_home_assistant";
drop table if exists public."user_device_access_PRB_home_assistant";
drop table if exists public."device_PRB_home_assistant";
drop table if exists public."user_PRB_home_assistant";

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'esp_board_prb_home_assistant'
  ) then
    alter publication supabase_realtime drop table public.esp_board_prb_home_assistant;
  end if;
end $$;
drop table if exists public.esp_board_prb_home_assistant;

drop function if exists public.set_board_relay(text, integer, text);
drop function if exists public.esp_board_touch();
