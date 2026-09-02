-- Backfill visit_count for all customers
-- Counts distinct calendar dates from completed bookings + non-cancelled orders
update public.customers c
set visit_count = coalesce((
  select count(*)
  from (
    select b.date
    from public.bookings b
    where b.customer_id = c.id
      and b.status not in ('cancelled', 'no_show')
    union
    select o.created_at::date
    from public.orders o
    where o.customer_id = c.id
      and o.status <> 'cancelled'
  ) v
), 0);
