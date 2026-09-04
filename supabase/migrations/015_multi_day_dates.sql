-- 015_multi_day_dates.sql
-- Allow bookings and orders to span multiple days.
--
-- bookings  : the existing `date` column remains the start/check-in date.
--             A nullable end_date records the last day of a multi-day stay;
--             NULL means a single-day booking (equal to `date`).
-- orders    : orders previously had no date field. Add optional start_date /
--             end_date so an order can be dated and can span multiple days.

alter table public.bookings
  add column if not exists end_date date;

alter table public.orders
  add column if not exists start_date date,
  add column if not exists end_date  date;

create index if not exists idx_bookings_end_date on public.bookings(end_date);
create index if not exists idx_orders_start_date on public.orders(start_date);
