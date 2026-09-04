-- LocalFlow CRM - Apply latest migrations to an existing project
-- This file runs migrations 007-015 for projects that were set up earlier.
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

