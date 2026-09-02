-- LocalFlow CRM - Reset demo data
-- Truncates all business-scoped tables (keeps schema). Useful for the
-- "Reset demo data" action in Settings.

-- Danger: run in a transaction so a failure rolls back cleanly
begin;

truncate table public.notifications cascade;
truncate table public.activities cascade;
truncate table public.leads cascade;
truncate table public.tasks cascade;
truncate table public.orders cascade;
truncate table public.bookings cascade;
truncate table public.customer_notes cascade;
truncate table public.customers cascade;
truncate table public.settings cascade;

commit;
