-- LocalFlow CRM - Repair: backfill missing profiles for existing auth users
-- Some users who signed up before the handle_new_user() trigger was fixed do not
-- have a profiles row. Without one, current_business_id() returns NULL, RLS blocks
-- all inserts (customers, bookings, etc.), and the app shows no profile.
--
-- Run this in your Supabase SQL Editor. It is safe to run repeatedly.

-- Ensure there is at least one business to attach orphaned users to.
insert into public.businesses (name, type)
select 'My Business', 'other'
where not exists (select 1 from public.businesses)
on conflict do nothing;

-- Backfill a profile for every auth user that doesn't already have one.
insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
select
  u.id,
  (select id from public.businesses order by created_at asc limit 1),
  coalesce(u.raw_user_meta_data->>'first_name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'last_name', ''),
  u.email,
  'owner'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.user_id = u.id
)
on conflict (user_id, business_id) do nothing;
