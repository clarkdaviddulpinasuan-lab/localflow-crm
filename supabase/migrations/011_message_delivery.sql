-- LocalFlow CRM - Message delivery pipeline (Phase: Real Messaging)
-- Additive migration: communications track real provider delivery.
-- messages are queued as 'pending', then an Edge Function sends them and
-- updates status to 'delivered' (or 'failed' with an error message).
-- Run via the Supabase SQL editor or `supabase db push`.

-- ============================================================
-- ENUM EXTENSION
-- ============================================================
do $$ begin
  alter type public.communication_status add value if not exists 'pending';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.communication_status add value if not exists 'delivered';
exception when duplicate_object then null; end $$;

-- ============================================================
-- COMMUNICATIONS: provider delivery columns
-- ============================================================
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