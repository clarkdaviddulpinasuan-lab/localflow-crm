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