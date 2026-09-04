-- 013_booking_items.sql
-- Create the booking_items table for line items charged against a booking/stay.

create table public.booking_items (
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

create index idx_booking_items_business_id on public.booking_items(business_id);
create index idx_booking_items_booking_id on public.booking_items(booking_id);

alter table public.booking_items enable row level security;

create policy "booking_items_select_business" on public.booking_items
  for select using (business_id = public.current_business_id());

create policy "booking_items_insert_business" on public.booking_items
  for insert with check (business_id = public.current_business_id());

create policy "booking_items_update_business" on public.booking_items
  for update using (business_id = public.current_business_id());

create policy "booking_items_delete_business" on public.booking_items
  for delete using (business_id = public.current_business_id());
