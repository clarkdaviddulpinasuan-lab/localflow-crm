-- 014_booking_check_in_out.sql
-- Add check-in / check-out tracking columns to the bookings table.
-- These are populated by the check-in / check-out actions in the bookings UI.

alter table public.bookings
  add column if not exists check_in_date  date,
  add column if not exists check_in_time  time,
  add column if not exists check_out_date date,
  add column if not exists check_out_time time;

create index if not exists idx_bookings_check_in on public.bookings(check_in_date);
create index if not exists idx_bookings_check_out on public.bookings(check_out_date);
