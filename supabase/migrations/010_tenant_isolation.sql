-- LocalFlow CRM - Tenant isolation: each signup gets their own business
-- The original handle_new_user() trigger from 001_init.sql attached every new
-- user to the OLDEST business in the database. On a public deployment that meant
-- anyone who signed up would land inside the first user's business and see their
-- data. This migration replaces the trigger so each new account creates its own
-- isolated business (true multi-tenancy).
--
-- Safe to run repeatedly. Does not touch existing users/businesses.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_business_id uuid;
  first_name text;
  last_name text;
begin
  first_name := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  last_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), '');

  -- Each signup creates a fresh, private business.
  insert into public.businesses (name, type)
  values (
    case
      when first_name = '' then 'My Business'
      else first_name || '''s Business'
    end,
    'other'
  )
  returning id into new_business_id;

  insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
  values (new.id, new_business_id, first_name, last_name, new.email, 'owner')
  on conflict (user_id, business_id) do nothing;

  -- Default per-business presentation config (see 004_business_config.sql).
  insert into public.settings (business_id, key, value)
  values (new_business_id, 'dashboard_config', '{}')
  on conflict (business_id, key) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();