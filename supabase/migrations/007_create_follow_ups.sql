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