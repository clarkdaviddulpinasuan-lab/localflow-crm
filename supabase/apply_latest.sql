-- LocalFlow CRM - Apply latest migrations to an existing project
-- This file runs migrations 007-018 for projects that were set up earlier.
-- It is safe to re-run. Paste the whole file into the Supabase SQL editor.

-- ============================================================
-- SOURCE: 007_create_follow_ups.sql
-- ============================================================
-- LocalFlow CRM - Add follow_ups table (Phase F)
-- Additive migration: creates a follow-up queue per customer.
-- Run via the Supabase SQL editor or `supabase db push`.

-- ============================================================
-- CUSTOM TYPES
-- ============================================================
do $$ begin
  create type follow_up_status as enum ('pending', 'completed', 'skipped');
exception when duplicate_object then null; end $$;

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
create table if not exists public.follow_ups (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  due_date date not null default (now() at time zone 'utc')::date,
  note text,
  status follow_up_status not null default 'pending',
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_follow_ups_business_id on public.follow_ups(business_id);
create index if not exists idx_follow_ups_customer_id on public.follow_ups(customer_id);
create index if not exists idx_follow_ups_due_date on public.follow_ups(due_date);
create index if not exists idx_follow_ups_status on public.follow_ups(status);

drop trigger if exists follow_ups_updated_at on public.follow_ups;
create trigger follow_ups_updated_at before update on public.follow_ups
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.follow_ups enable row level security;

drop policy if exists "follow_ups_select_business" on public.follow_ups;
create policy "follow_ups_select_business"
  on public.follow_ups for select
  using (business_id = public.current_business_id());

drop policy if exists "follow_ups_insert_business" on public.follow_ups;
create policy "follow_ups_insert_business"
  on public.follow_ups for insert
  with check (business_id = public.current_business_id());

drop policy if exists "follow_ups_update_business" on public.follow_ups;
create policy "follow_ups_update_business"
  on public.follow_ups for update
  using (business_id = public.current_business_id());

drop policy if exists "follow_ups_delete_business" on public.follow_ups;
create policy "follow_ups_delete_business"
  on public.follow_ups for delete
  using (business_id = public.current_business_id());

-- ============================================================
-- SOURCE: 008_create_templates_communications.sql
-- ============================================================
-- LocalFlow CRM - Add message_templates + communications tables (Phase H)
-- Additive migration: message templates per business + a customer communication ledger.
-- Run via the Supabase SQL editor or `supabase db push`.

-- ============================================================
-- CUSTOM TYPES
-- ============================================================
do $$ begin
  create type template_channel as enum ('email', 'sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type communication_status as enum ('sent', 'failed');
exception when duplicate_object then null; end $$;

-- ============================================================
-- MESSAGE TEMPLATES
-- ============================================================
create table if not exists public.message_templates (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  channel template_channel not null default 'sms',
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_message_templates_business_id on public.message_templates(business_id);

drop trigger if exists message_templates_updated_at on public.message_templates;
create trigger message_templates_updated_at before update on public.message_templates
  for each row execute function public.set_updated_at();

-- ============================================================
-- COMMUNICATIONS
-- ============================================================
create table if not exists public.communications (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel template_channel not null,
  template_id uuid references public.message_templates(id) on delete set null,
  subject text,
  body text not null,
  status communication_status not null default 'sent',
  sent_at timestamptz not null default now()
);

create index if not exists idx_communications_business_id on public.communications(business_id);
create index if not exists idx_communications_customer_id on public.communications(customer_id);
create index if not exists idx_communications_sent_at on public.communications(sent_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.message_templates enable row level security;
alter table public.communications enable row level security;

drop policy if exists "message_templates_select_business" on public.message_templates;
create policy "message_templates_select_business"
  on public.message_templates for select
  using (business_id = public.current_business_id());

drop policy if exists "message_templates_insert_business" on public.message_templates;
create policy "message_templates_insert_business"
  on public.message_templates for insert
  with check (business_id = public.current_business_id());

drop policy if exists "message_templates_update_business" on public.message_templates;
create policy "message_templates_update_business"
  on public.message_templates for update
  using (business_id = public.current_business_id());

drop policy if exists "message_templates_delete_business" on public.message_templates;
create policy "message_templates_delete_business"
  on public.message_templates for delete
  using (business_id = public.current_business_id());

drop policy if exists "communications_select_business" on public.communications;
create policy "communications_select_business"
  on public.communications for select
  using (business_id = public.current_business_id());

drop policy if exists "communications_insert_business" on public.communications;
create policy "communications_insert_business"
  on public.communications for insert
  with check (business_id = public.current_business_id());

drop policy if exists "communications_delete_business" on public.communications;
create policy "communications_delete_business"
  on public.communications for delete
  using (business_id = public.current_business_id());

-- ============================================================
-- SOURCE: 009_link_orders_to_bookings.sql
-- ============================================================
-- LocalFlow CRM - Link orders to bookings/stays (accessibility improvement)
-- Additive migration: an order can be recorded against a booking (e.g. food or
-- rental charged during a 5-night stay). Deleting the booking keeps the order
-- but clears the link (on delete set null).
-- Run via the Supabase SQL editor or `supabase db push`.

alter table public.orders
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create index if not exists idx_orders_booking_id on public.orders(booking_id);

-- ============================================================
-- SOURCE: 010_tenant_isolation.sql
-- ============================================================
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

-- ============================================================
-- SOURCE: 011_message_delivery.sql
-- ============================================================
-- LocalFlow CRM - Message delivery pipeline (Phase: Real Messaging)
-- Additive migration: communications track real provider delivery.
-- messages are queued as 'pending', then an Edge Function sends them and
-- updates status to 'delivered' (or 'failed' with an error message).

do $$ begin
  alter type public.communication_status add value if not exists 'pending';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.communication_status add value if not exists 'delivered';
exception when duplicate_object then null; end $$;

alter table public.communications
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists error text,
  add column if not exists delivered_at timestamptz;

create index if not exists idx_communications_status on public.communications(status);

-- The send-message Edge Function updates the row's delivery state as the
-- calling user, so it needs a business-scoped UPDATE policy (008 only granted
-- select/insert/delete).
drop policy if exists "communications_update_business" on public.communications;
create policy "communications_update_business"
  on public.communications for update
  using (business_id = public.current_business_id());

-- ============================================================
-- SOURCE: 012_resources.sql
-- ============================================================
-- LocalFlow CRM - Add resources table (bookable resources: rooms, tables, etc.)

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  type        text not null default 'resource',
  color       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_resources_business_id on public.resources(business_id);
create index if not exists idx_resources_name on public.resources(business_id, name);
create index if not exists idx_resources_active on public.resources(business_id, active);

alter table public.resources enable row level security;

drop policy if exists "resources_select_business" on public.resources;
create policy "resources_select_business" on public.resources
  for select using (business_id = public.current_business_id());
drop policy if exists "resources_insert_business" on public.resources;
create policy "resources_insert_business" on public.resources
  for insert with check (business_id = public.current_business_id());
drop policy if exists "resources_update_business" on public.resources;
create policy "resources_update_business" on public.resources
  for update using (business_id = public.current_business_id());
drop policy if exists "resources_delete_business" on public.resources;
create policy "resources_delete_business" on public.resources
  for delete using (business_id = public.current_business_id());

-- ============================================================
-- SOURCE: 013_booking_items.sql
-- ============================================================
-- LocalFlow CRM - Add booking_items table (line items charged to a booking/stay)

create table if not exists public.booking_items (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  name        text not null,
  quantity    integer not null default 1,
  unit_price  numeric(12,2) not null default 0,
  total       numeric(12,2) not null generated always as (quantity * unit_price) stored,
  category    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_booking_items_business_id on public.booking_items(business_id);
create index if not exists idx_booking_items_booking_id on public.booking_items(booking_id);

alter table public.booking_items enable row level security;

drop policy if exists "booking_items_select_business" on public.booking_items;
create policy "booking_items_select_business" on public.booking_items
  for select using (business_id = public.current_business_id());
drop policy if exists "booking_items_insert_business" on public.booking_items;
create policy "booking_items_insert_business" on public.booking_items
  for insert with check (business_id = public.current_business_id());
drop policy if exists "booking_items_update_business" on public.booking_items;
create policy "booking_items_update_business" on public.booking_items
  for update using (business_id = public.current_business_id());
drop policy if exists "booking_items_delete_business" on public.booking_items;
create policy "booking_items_delete_business" on public.booking_items
  for delete using (business_id = public.current_business_id());

-- ============================================================
-- SOURCE: 014_booking_check_in_out.sql
-- ============================================================
-- LocalFlow CRM - Add check-in / check-out tracking columns to bookings.

alter table public.bookings
  add column if not exists check_in_date  date,
  add column if not exists check_in_time  time,
  add column if not exists check_out_date date,
  add column if not exists check_out_time time;

create index if not exists idx_bookings_check_in on public.bookings(check_in_date);
create index if not exists idx_bookings_check_out on public.bookings(check_out_date);

-- ============================================================
-- SOURCE: 015_multi_day_dates.sql
-- ============================================================
-- LocalFlow CRM - Allow bookings and orders to span multiple days.
-- bookings.date remains the start day; end_date is NULL for single-day.
-- orders gain optional start_date / end_date.

alter table public.bookings
  add column if not exists end_date date;

alter table public.orders
  add column if not exists start_date date,
  add column if not exists end_date  date;

create index if not exists idx_bookings_end_date on public.bookings(end_date);
create index if not exists idx_orders_start_date on public.orders(start_date);

-- ============================================================
-- SOURCE: 016_create_avatars_bucket.sql
-- ============================================================
-- Create the avatars storage bucket for profile pictures
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own avatar
create policy "Users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatar
create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatar
create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to avatars
create policy "Public read access for avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- ============================================================
-- ============================================================
-- SOURCE: 017_team_invites.sql
-- ============================================================
-- ============================================================================
-- LocalFlow CRM - Team invitations: multiple accounts sharing ONE business
--
-- Before this migration, every new signup created its OWN business (migration
-- 010), and the "Add Member" flow only worked in tests (it inserted a profiles
-- row without a user_id, which the real schema rejects).
--
-- This migration adds the missing piece: invitations. An owner/manager sends an
-- invite (email + role + token); the invitee signs up at /signup?invite=<token>;
-- the signup trigger then attaches the new account to the INVITER's business
-- instead of minting a fresh one. The token is validated server-side in SQL, so
-- no client can force-join a business without a valid, pending, unexpired invite.
--
-- Safe to run repeatedly.
-- ============================================================================

-- ============================================================
-- INVITATIONS
-- ============================================================
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role user_role not null default 'staff',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create unique index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_business_id on public.invitations(business_id);
create index if not exists idx_invitations_email on public.invitations(email);

-- One pending invite per email per business.
create unique index if not exists idx_invitations_pending_email
  on public.invitations (business_id, lower(email))
  where status = 'pending';

drop trigger if exists invitations_updated_at on public.invitations;
create trigger invitations_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

-- ============================================================
-- HELPER: role gating for who may invite (owners, and managers
-- inviting anything except another owner)
-- ============================================================
create or replace function public.current_user_can_invite(p_role user_role)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.business_id = public.current_business_id()
      and (p.role = 'owner' or (p.role = 'manager' and p_role <> 'owner'))
  );
$$;

grant execute on function public.current_user_can_invite(user_role) to anon, authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.invitations enable row level security;

-- Only the business can see its own pending invites.
drop policy if exists "invitations_select_business" on public.invitations;
create policy "invitations_select_business"
  on public.invitations for select
  using (business_id = public.current_business_id());

drop policy if exists "invitations_insert_business" on public.invitations;
create policy "invitations_insert_business"
  on public.invitations for insert
  with check (
    business_id = public.current_business_id()
    and public.current_user_can_invite(role)
  );

-- Revoking an invite = deleting it; same role gating as creating one.
drop policy if exists "invitations_delete_business" on public.invitations;
create policy "invitations_delete_business"
  on public.invitations for delete
  using (
    business_id = public.current_business_id()
    and public.current_user_can_invite(role)
  );

-- ============================================================
-- INVITE SUMMARY for the public signup page (anon-readable)
-- Returns only the business name + inviter for a VALID pending
-- token, so the invitee sees "Almar invited you to X". The token
-- is an unguessable UUID that only the invited party holds.
-- ============================================================
create or replace function public.get_invite_summary(p_token uuid)
returns table (business_name text, invited_by text)
language sql stable security definer set search_path = public as $$
  select b.name, p.first_name || ' ' || p.last_name
  from public.invitations i
  join public.businesses b on b.id = i.business_id
  join public.profiles p on p.user_id = i.invited_by
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;
$$;

grant execute on function public.get_invite_summary(uuid) to anon, authenticated, service_role;

-- ============================================================
-- SIGNUP TRIGGER: attach invitees to an existing business
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
  v_invite public.invitations%rowtype;
  first_name text;
  last_name text;
  new_business_id uuid;
begin
  first_name := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  last_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), '');

  -- ---- Invite path: join an existing business ------------------------------
  if new.raw_user_meta_data ? 'invite_token' then
    begin
      v_token := nullif(new.raw_user_meta_data->>'invite_token', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'This invitation link is not valid.';
    end;

    select i.* into v_invite
    from public.invitations i
    where i.token = v_token
      and i.status = 'pending'
      and i.expires_at > now()
      and lower(i.email) = lower(new.email)
    for update;

    if v_invite.id is null then
      raise exception 'This invitation is invalid, expired, or already used.';
    end if;

    insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
    values (new.id, v_invite.business_id, first_name, last_name, new.email, v_invite.role)
    on conflict (user_id, business_id) do nothing;

    insert into public.settings (business_id, key, value)
    values (v_invite.business_id, 'dashboard_config', '{}')
    on conflict (business_id, key) do nothing;

    update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_user_id = new.id
    where id = v_invite.id;

    insert into public.notifications (user_id, business_id, title, message, type)
    values (
      v_invite.invited_by,
      v_invite.business_id,
      'New team member on board',
      first_name || ' ' || last_name || ' joined your business.',
      'system'
    );

    return new;
  end if;

  -- ---- Default path (migration 010 behavior): fresh business per signup ----
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

  insert into public.settings (business_id, key, value)
  values (new_business_id, 'dashboard_config', '{}')
  on conflict (business_id, key) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- LAST-OWNER GUARD: a business must keep at least one owner
-- ============================================================
create or replace function public.protect_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owners int;
begin
  select count(*) into v_owners
  from public.profiles
  where business_id = old.business_id and role = 'owner';

  if old.role = 'owner' and v_owners <= 1 then
    if tg_op = 'DELETE' or (new.role is distinct from old.role and new.role <> 'owner') then
      raise exception 'A business must keep at least one owner.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_protect_last_owner on public.profiles;
create trigger profiles_protect_last_owner
  before delete or update of role on public.profiles
  for each row execute function public.protect_last_owner();
-- ============================================================
-- SOURCE: 018_multi_business.sql
-- ============================================================
-- ============================================================================
-- LocalFlow CRM - Multi-business membership, admin-created accounts, and
-- self-serve "leave business".
--
-- Migration 017 allowed multiple ACCOUNTS to share one business. This one
-- allows one ACCOUNT to belong to SEVERAL businesses and switch between them
-- (invitees who own a business, team coordinators, etc.), lets an owner/manager
-- create a full account without the invite link, and lets a member leave a
-- business themselves.
--
-- How "current business" works: the browser hits a fresh pooled DB session on
-- every request, so session-scoped claims cannot persist. Each membership keeps
-- a row in user_current_business (the active business per auth user). RLS's
-- current_business_id() reads it first and falls back to a single membership.
-- The row is written at membership creation (signup/join/admin-create) and only
-- ever changes through switch_business() / leave_business().
--
-- Safe to run repeatedly.
-- ============================================================================

-- ============================================================
-- 1. ACTIVE-BUSINESS PREFERENCE per user
-- ============================================================
create table if not exists public.user_current_business (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- No select/update policies: only security definer functions touch this table,
-- so the client can never read or forge another user's preference directly.

-- ============================================================
-- 2. current_business_id(): prefs row first, single membership as fallback
--    (security definer so RLS on profiles/user_current_business never recurses,
--    and create-or-replace so dependent RLS policies are NOT dropped)
-- ============================================================
create or replace function public.current_business_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select uc.business_id from public.user_current_business uc where uc.user_id = auth.uid()),
    (select p.business_id from public.profiles p where p.user_id = auth.uid() limit 1)
  );
$$;

comment on function public.current_business_id() is
  'Active business for the signed-in user: user_current_business first, else the lone membership.';

-- ============================================================
-- 3. RPC: query the active business (client uses this instead of
--    guessing from profiles, so it can never drift from RLS)
-- ============================================================
create or replace function public.get_current_business()
returns uuid language sql stable security definer set search_path = public as $$
  select public.current_business_id();
$$;

grant execute on function public.get_current_business() to anon, authenticated, service_role;

-- ============================================================
-- 4. RPC: switch the active business (validated membership only)
-- ============================================================
create or replace function public.switch_business(p_business_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.business_id = p_business_id
  ) then
    raise exception 'You are not a member of that business.';
  end if;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (auth.uid(), p_business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();
end;
$$;

grant execute on function public.switch_business(uuid) to authenticated;

-- ============================================================
-- 5. RPC: accept a pending invitation with an EXISTING account
--    (an invitee who already has an account signs in and claims
--    the invite: joins the business, consumes the invite, and
--    makes it the active business)
-- ============================================================
create or replace function public.accept_invite(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invitations%rowtype;
  v_dummy uuid;
begin
  select i.* into v_invite
  from public.invitations i
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  for update;

  if v_invite.id is null then
    raise exception 'This invitation is invalid, expired, or already used.';
  end if;

  select id into v_dummy
  from public.profiles
  where user_id = auth.uid() and business_id = v_invite.business_id;
  if v_dummy is not null then
    raise exception 'You are already a member of that business.';
  end if;

  update public.invitations
  set status = 'accepted', accepted_at = now(), accepted_user_id = auth.uid()
  where id = v_invite.id;

  insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
  select auth.uid(), v_invite.business_id,
         coalesce(nullif(trim(raw_user_meta_data->>'first_name'), ''), 'New'),
         coalesce(nullif(trim(raw_user_meta_data->>'last_name'), ''), 'Member'),
         lower(email), v_invite.role
  from auth.users where id = auth.uid()
  on conflict (user_id, business_id) do nothing;

  insert into public.settings (business_id, key, value)
  values (v_invite.business_id, 'dashboard_config', '{}')
  on conflict (business_id, key) do nothing;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (auth.uid(), v_invite.business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

  insert into public.notifications (user_id, business_id, title, message, type)
  values (
    v_invite.invited_by,
    v_invite.business_id,
    'New team member on board',
    'A teammate joined your business.',
    'system'
  );
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ============================================================
-- 6. RPC: leave the active business. Owners are protected by the
--    profiles_protect_last_owner trigger. If other memberships
--    remain, the active preference moves to one of them.
-- ============================================================
create or replace function public.leave_business()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_current uuid;
  v_next uuid;
begin
  select public.current_business_id() into v_current;
  if v_current is null then
    return;
  end if;

  delete from public.profiles
  where user_id = auth.uid() and business_id = v_current;

  delete from public.user_current_business
  where user_id = auth.uid() and business_id = v_current;

  select p.business_id into v_next
  from public.profiles p
  where p.user_id = auth.uid()
  order by p.created_at asc
  limit 1;

  if v_next is not null then
    insert into public.user_current_business (user_id, business_id, updated_at)
    values (auth.uid(), v_next, now())
    on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();
  end if;
end;
$$;

grant execute on function public.leave_business() to authenticated;

-- ============================================================
-- 7. RPC: admin-created account (owner/manager creates a full
--    confirmed account, or attaches an existing one, to the
--    caller's active business)
-- ============================================================
create or replace function public.admin_create_member(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_password text,
  p_role user_role
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_user_id uuid := gen_random_uuid();
  v_existing_user uuid;
  v_name text;
begin
  if not public.current_user_can_invite(p_role) then
    raise exception 'You do not have permission to create an account with that role.';
  end if;
  if nullif(p_first_name, '') is null or nullif(p_last_name, '') is null then
    raise exception 'First and last name are required.';
  end if;
  if nullif(p_email, '') is null or position('@' in p_email) = 0 then
    raise exception 'A valid email is required.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Password must be at least 8 characters.';
  end if;

  select public.current_business_id() into v_business_id;
  if v_business_id is null then
    raise exception 'No active business found.';
  end if;

  -- ---- Existing account? Attach it (unless already a member) ----------------
  select u.id into v_existing_user from auth.users u where lower(u.email) = lower(p_email) limit 1;
  if v_existing_user is not null then
    if exists (
      select 1 from public.profiles p
      where p.user_id = v_existing_user and p.business_id = v_business_id
    ) then
      raise exception 'That account is already a member of this business.';
    end if;

    insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
    values (v_existing_user, v_business_id, p_first_name, p_last_name, lower(trim(p_email)), p_role)
    on conflict (user_id, business_id) do nothing;

    insert into public.user_current_business (user_id, business_id, updated_at)
    values (v_existing_user, v_business_id, now())
    on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

    return v_existing_user;
  end if;

  v_name := p_first_name || ' ' || p_last_name;

  -- ---- New account: insert the auth user directly (mirrors the GoTrue
  --      signup trigger shape). handle_new_user() returns early on the
  --      admin_created marker below, so no phantom business/profile is minted.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    lower(trim(p_email)), crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'admin_created', true),
    now(), now()
  );

  insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
  values (v_user_id, v_business_id, p_first_name, p_last_name, lower(trim(p_email)), p_role)
  on conflict (user_id, business_id) do nothing;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (v_user_id, v_business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

  return v_user_id;
end;
$$;

grant execute on function public.admin_create_member(text, text, text, text, user_role) to authenticated;

-- ============================================================
-- 8. handle_new_user(): honor admin-created passthrough and
--    record the active business for every new membership
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
  v_invite public.invitations%rowtype;
  first_name text;
  last_name text;
  new_business_id uuid;
begin
  first_name := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  last_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), '');

  -- ---- Admin-created accounts provision themselves (migration 018) --------
  if new.raw_user_meta_data ? 'admin_created' then
    return new;
  end if;

  -- ---- Invite path: join an existing business ------------------------------
  if new.raw_user_meta_data ? 'invite_token' then
    begin
      v_token := nullif(new.raw_user_meta_data->>'invite_token', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'This invitation link is not valid.';
    end;

    select i.* into v_invite
    from public.invitations i
    where i.token = v_token
      and i.status = 'pending'
      and i.expires_at > now()
      and lower(i.email) = lower(new.email)
    for update;

    if v_invite.id is null then
      raise exception 'This invitation is invalid, expired, or already used.';
    end if;

    insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
    values (new.id, v_invite.business_id, first_name, last_name, new.email, v_invite.role)
    on conflict (user_id, business_id) do nothing;

    insert into public.settings (business_id, key, value)
    values (v_invite.business_id, 'dashboard_config', '{}')
    on conflict (business_id, key) do nothing;

    insert into public.user_current_business (user_id, business_id, updated_at)
    values (new.id, v_invite.business_id, now())
    on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

    update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_user_id = new.id
    where id = v_invite.id;

    insert into public.notifications (user_id, business_id, title, message, type)
    values (
      v_invite.invited_by,
      v_invite.business_id,
      'New team member on board',
      first_name || ' ' || last_name || ' joined your business.',
      'system'
    );

    return new;
  end if;

  -- ---- Default path: fresh business per signup ------------------------------
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

  insert into public.settings (business_id, key, value)
  values (new_business_id, 'dashboard_config', '{}')
  on conflict (business_id, key) do nothing;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (new.id, new_business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();