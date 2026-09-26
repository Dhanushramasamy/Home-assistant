-- Adds the role column the app's "Create User" feature writes.
-- Run once in the Supabase SQL editor. Existing users are kept; they become
-- 'user' except DhanushRaja, who stays admin.
alter table public."user_PRB_home_assistant"
  add column if not exists role text not null default 'user' check (role in ('admin', 'user'));

update public."user_PRB_home_assistant" set role = 'admin' where lower(username) = 'dhanushraja';
