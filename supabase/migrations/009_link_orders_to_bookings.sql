-- LocalFlow CRM - Link orders to bookings/stays (accessibility improvement)
-- Additive migration: an order can be recorded against a booking (e.g. food or
-- rental charged during a 5-night stay). Deleting the booking keeps the order
-- but clears the link (on delete set null).
-- Run via the Supabase SQL editor or `supabase db push`.

alter table public.orders
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create index if not exists idx_orders_booking_id on public.orders(booking_id);