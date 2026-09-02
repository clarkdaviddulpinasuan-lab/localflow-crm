-- LocalFlow CRM - Initial schema
-- PostgreSQL via Supabase
-- Run this migration in your Supabase SQL editor, or via the Supabase CLI:
--   supabase db push

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- CUSTOM TYPES
-- ============================================================
do $$ begin
  create type user_role as enum ('owner', 'manager', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type business_type as enum (
    'hotel', 'resort', 'guesthouse', 'restaurant', 'cafe',
    'sari_sari', 'retail', 'service', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type customer_status as enum ('new', 'active', 'vip', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type customer_type as enum ('guest', 'local', 'corporate', 'regular', 'walk_in');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('paid', 'pending', 'partial', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('new', 'processing', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_stage as enum ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('booking', 'task', 'payment', 'lead', 'customer', 'system');
exception when duplicate_object then null; end $$;

-- ============================================================
-- BUSINESSES
-- ============================================================
create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type business_type not null default 'other',
  location text,
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  team_size integer not null default 1,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROFILES (one per auth user, linked to a business)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  role user_role not null default 'staff',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_id)
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  type customer_type not null default 'regular',
  status customer_status not null default 'new',
  total_spent numeric(12,2) not null default 0,
  visit_count integer not null default 0,
  last_activity timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CUSTOMER NOTES
-- ============================================================
create table if not exists public.customer_notes (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- BOOKINGS
-- ============================================================
create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  resource text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  guests integer not null default 1,
  status booking_status not null default 'pending',
  amount numeric(12,2) not null default 0,
  payment_status payment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ORDERS
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_number text not null,
  items text not null,
  description text,
  total numeric(12,2) not null default 0,
  payment_status payment_status not null default 'pending',
  status order_status not null default 'new',
  staff_member text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, order_number)
);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  due_date date not null,
  priority task_priority not null default 'medium',
  status task_status not null default 'todo',
  assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- LEADS
-- ============================================================
create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  company text,
  phone text,
  email text,
  source text,
  stage lead_stage not null default 'new',
  estimated_value numeric(12,2) not null default 0,
  next_action text,
  assigned_staff text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ACTIVITIES
-- ============================================================
create table if not exists public.activities (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  message text not null,
  type notification_type not null default 'system',
  read boolean not null default false,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SETTINGS (key/value per business)
-- ============================================================
create table if not exists public.settings (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, key)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_profiles_business_id on public.profiles(business_id);

create index if not exists idx_customers_business_id on public.customers(business_id);
create index if not exists idx_customers_email on public.customers(email);
create index if not exists idx_customers_status on public.customers(status);

create index if not exists idx_customer_notes_customer_id on public.customer_notes(customer_id);

create index if not exists idx_bookings_business_id on public.bookings(business_id);
create index if not exists idx_bookings_date on public.bookings(date);
create index if not exists idx_bookings_status on public.bookings(status);

create index if not exists idx_orders_business_id on public.orders(business_id);
create index if not exists idx_orders_created_at on public.orders(created_at);

create index if not exists idx_tasks_business_id on public.tasks(business_id);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_status on public.tasks(status);

create index if not exists idx_leads_business_id on public.leads(business_id);
create index if not exists idx_leads_stage on public.leads(stage);

create index if not exists idx_activities_business_id on public.activities(business_id);
create index if not exists idx_activities_created_at on public.activities(created_at);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_business_id on public.notifications(business_id);

create index if not exists idx_settings_business_id on public.settings(business_id);

-- ============================================================
-- TRIGGERS: updated_at maintenance
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_updated_at on public.businesses;
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists customer_notes_updated_at on public.customer_notes;
create trigger customer_notes_updated_at before update on public.customer_notes
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists settings_updated_at on public.settings;
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- HELPER: current business for the signed-in user
-- ============================================================
create or replace function public.current_business_id()
returns uuid language sql stable as $$
  select p.business_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.bookings enable row level security;
alter table public.orders enable row level security;
alter table public.tasks enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;

-- A user can read the business they belong to
drop policy if exists "businesses_select_own" on public.businesses;
create policy "businesses_select_own"
  on public.businesses for select
  using (id = public.current_business_id());

-- A user can update their own business
drop policy if exists "businesses_update_own" on public.businesses;
create policy "businesses_update_own"
  on public.businesses for update
  using (id = public.current_business_id());

-- Only the business owner can delete / insert businesses handled via owner trigger below.
-- Kept restrictive: inserts not allowed via API for safety.

-- Profiles: users see their own profile, and profiles within their business
drop policy if exists "profiles_select_own_and_business" on public.profiles;
create policy "profiles_select_own_and_business"
  on public.profiles for select
  using (
    user_id = auth.uid()
    or business_id = public.current_business_id()
  );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (user_id = auth.uid());

drop policy if exists "profiles_update_own_or_owner" on public.profiles;
create policy "profiles_update_own_or_owner"
  on public.profiles for update
  using (
    user_id = auth.uid()
    or (
      business_id = public.current_business_id()
      and exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.role = 'owner' and p.business_id = profiles.business_id
      )
    )
  );

-- Generic helper policy for business-scoped tables (customers, bookings, orders, tasks, leads, activities, settings)
create or replace function public.policies_apply()
returns boolean language sql stable as $$
  select
    (select business_id from public.profiles where user_id = auth.uid()) is not null
$$;

-- CUSTOMERS
drop policy if exists "customers_select_business" on public.customers;
create policy "customers_select_business"
  on public.customers for select
  using (business_id = public.current_business_id());
drop policy if exists "customers_insert_business" on public.customers;
create policy "customers_insert_business"
  on public.customers for insert
  with check (business_id = public.current_business_id());
drop policy if exists "customers_update_business" on public.customers;
create policy "customers_update_business"
  on public.customers for update
  using (business_id = public.current_business_id());
drop policy if exists "customers_delete_business" on public.customers;
create policy "customers_delete_business"
  on public.customers for delete
  using (business_id = public.current_business_id());

-- CUSTOMER NOTES
drop policy if exists "customer_notes_select_business" on public.customer_notes;
create policy "customer_notes_select_business"
  on public.customer_notes for select
  using (business_id = public.current_business_id());
drop policy if exists "customer_notes_insert_business" on public.customer_notes;
create policy "customer_notes_insert_business"
  on public.customer_notes for insert
  with check (business_id = public.current_business_id());
drop policy if exists "customer_notes_update_business" on public.customer_notes;
create policy "customer_notes_update_business"
  on public.customer_notes for update
  using (business_id = public.current_business_id());
drop policy if exists "customer_notes_delete_business" on public.customer_notes;
create policy "customer_notes_delete_business"
  on public.customer_notes for delete
  using (business_id = public.current_business_id());

-- BOOKINGS
drop policy if exists "bookings_select_business" on public.bookings;
create policy "bookings_select_business"
  on public.bookings for select
  using (business_id = public.current_business_id());
drop policy if exists "bookings_insert_business" on public.bookings;
create policy "bookings_insert_business"
  on public.bookings for insert
  with check (business_id = public.current_business_id());
drop policy if exists "bookings_update_business" on public.bookings;
create policy "bookings_update_business"
  on public.bookings for update
  using (business_id = public.current_business_id());
drop policy if exists "bookings_delete_business" on public.bookings;
create policy "bookings_delete_business"
  on public.bookings for delete
  using (business_id = public.current_business_id());

-- ORDERS
drop policy if exists "orders_select_business" on public.orders;
create policy "orders_select_business"
  on public.orders for select
  using (business_id = public.current_business_id());
drop policy if exists "orders_insert_business" on public.orders;
create policy "orders_insert_business"
  on public.orders for insert
  with check (business_id = public.current_business_id());
drop policy if exists "orders_update_business" on public.orders;
create policy "orders_update_business"
  on public.orders for update
  using (business_id = public.current_business_id());
drop policy if exists "orders_delete_business" on public.orders;
create policy "orders_delete_business"
  on public.orders for delete
  using (business_id = public.current_business_id());

-- TASKS
drop policy if exists "tasks_select_business" on public.tasks;
create policy "tasks_select_business"
  on public.tasks for select
  using (business_id = public.current_business_id());
drop policy if exists "tasks_insert_business" on public.tasks;
create policy "tasks_insert_business"
  on public.tasks for insert
  with check (business_id = public.current_business_id());
drop policy if exists "tasks_update_business" on public.tasks;
create policy "tasks_update_business"
  on public.tasks for update
  using (business_id = public.current_business_id());
drop policy if exists "tasks_delete_business" on public.tasks;
create policy "tasks_delete_business"
  on public.tasks for delete
  using (business_id = public.current_business_id());

-- LEADS
drop policy if exists "leads_select_business" on public.leads;
create policy "leads_select_business"
  on public.leads for select
  using (business_id = public.current_business_id());
drop policy if exists "leads_insert_business" on public.leads;
create policy "leads_insert_business"
  on public.leads for insert
  with check (business_id = public.current_business_id());
drop policy if exists "leads_update_business" on public.leads;
create policy "leads_update_business"
  on public.leads for update
  using (business_id = public.current_business_id());
drop policy if exists "leads_delete_business" on public.leads;
create policy "leads_delete_business"
  on public.leads for delete
  using (business_id = public.current_business_id());

-- ACTIVITIES
drop policy if exists "activities_select_business" on public.activities;
create policy "activities_select_business"
  on public.activities for select
  using (business_id = public.current_business_id());
drop policy if exists "activities_insert_business" on public.activities;
create policy "activities_insert_business"
  on public.activities for insert
  with check (business_id = public.current_business_id());
drop policy if exists "activities_delete_business" on public.activities;
create policy "activities_delete_business"
  on public.activities for delete
  using (business_id = public.current_business_id());

-- NOTIFICATIONS (scoped to the individual user, business-scoped)
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid());
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete
  using (user_id = auth.uid());

-- SETTINGS
drop policy if exists "settings_select_business" on public.settings;
create policy "settings_select_business"
  on public.settings for select
  using (business_id = public.current_business_id());
drop policy if exists "settings_insert_business" on public.settings;
create policy "settings_insert_business"
  on public.settings for insert
  with check (business_id = public.current_business_id());
drop policy if exists "settings_update_business" on public.settings;
create policy "settings_update_business"
  on public.settings for update
  using (business_id = public.current_business_id());
drop policy if exists "settings_delete_business" on public.settings;
create policy "settings_delete_business"
  on public.settings for delete
  using (business_id = public.current_business_id());

-- ============================================================
-- AUTO-PROFILE: create a profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.businesses) then
    insert into public.businesses (name, type) values ('My Business', 'other');
  end if;

  insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
  values (
    new.id,
    (select id from public.businesses order by created_at asc limit 1),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    'owner'
  )
  on conflict (user_id, business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
