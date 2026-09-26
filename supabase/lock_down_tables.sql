-- Locks the app's tables so the public (publishable/anon) key can't read or
-- change them. Only the server, using the secret service-role key, can.
--
-- ORDER MATTERS:
--   1. Set SUPABASE_SERVICE_ROLE_KEY (and SESSION_SECRET) in .env.local and in
--      Vercel -> Project -> Settings -> Environment Variables, then redeploy.
--   2. Then run this file in the Supabase SQL editor.
-- Running it before step 1 makes the app unable to read users or devices.
--
-- With RLS on and no policies, anon/authenticated roles get nothing; the
-- service role bypasses RLS.

alter table public."user_PRB_home_assistant" enable row level security;
alter table public."device_PRB_home_assistant" enable row level security;

do $$
begin
  if to_regclass('public."device_timer_PRB_home_assistant"') is not null then
    execute 'alter table public."device_timer_PRB_home_assistant" enable row level security';
  end if;
end $$;

-- Remove any old policies that allowed public access (names vary per project).
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('user_PRB_home_assistant', 'device_PRB_home_assistant', 'device_timer_PRB_home_assistant')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
