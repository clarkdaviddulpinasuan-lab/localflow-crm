-- LocalFlow CRM - Demo seed data
-- Creates the "Siargao Breeze Resort" demo business with realistic sample data.
-- Run AFTER 001_init.sql. Requires an existing auth user (see notes below).
--
-- NOTE: The seed assumes you have at least one auth user. The business is created
-- and the first profile is linked to the first auth user so that RLS is satisfied.

-- Business
insert into public.businesses (id, name, type, location, currency, timezone, team_size)
values (
  '00000000-0000-0000-0000-000000000001',
  'Siargao Breeze Resort',
  'resort',
  'General Luna, Siargao',
  'PHP',
  'Asia/Manila',
  5
)
on conflict (id) do nothing;

-- Link an owner profile to the first auth user (so the demo data is accessible)
insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
select
  u.id,
  '00000000-0000-0000-0000-000000000001',
  'Ana',
  'Reyes',
  u.email,
  'owner'
from auth.users u
order by u.created_at asc
limit 1
on conflict (user_id, business_id) do nothing;

-- Customers
insert into public.customers (id, business_id, first_name, last_name, email, phone, type, status, total_spent, visit_count, last_activity) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Maria', 'Santos', 'maria.santos@gmail.com', '+63 918 234 5678', 'regular', 'vip', 45200, 8, now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'John', 'Carter', 'john.carter@outlook.com', '+1 555 0123', 'guest', 'active', 32800, 3, now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Daniel', 'Cruz', 'daniel.cruz@yahoo.com', '+63 919 345 6789', 'local', 'active', 12500, 12, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Sophie', 'Laurent', 'sophie.l@icloud.com', '+33 6 12 34 56 78', 'guest', 'new', 0, 0, now()),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'Kenji', 'Tanaka', 'kenji.tanaka@gmail.com', '+81 90 1234 5678', 'guest', 'active', 28900, 2, now() - interval '15 days'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'Rachel', 'Nguyen', 'rachel.n@company.com', '+84 90 1234 567', 'corporate', 'active', 89400, 6, now() - interval '8 days')
on conflict (id) do nothing;

-- Bookings (relative dates keep the demo fresh on any day)
insert into public.bookings (id, business_id, customer_id, resource, date, start_time, end_time, guests, status, amount, payment_status, notes) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Room 101', (now() + interval '1 day')::date, '14:00', '12:00', 2, 'confirmed', 12500, 'paid', 'Anniversary trip. Requested ocean view.'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'Room 203', (now() + interval '3 days')::date, '15:00', '11:00', 1, 'pending', 8900, 'pending', 'Airport transfer needed.'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000105', 'Room 102', (now() - interval '1 day')::date, '14:00', '12:00', 2, 'completed', 15000, 'paid', 'Surfing trip. Early check-in if possible.')
on conflict (id) do nothing;

-- Orders
insert into public.orders (id, business_id, customer_id, order_number, items, description, total, payment_status, status, staff_member) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000105', 'ORD-2025-001', 'Island Hopping Tour Package', 'Full-day island hopping with lunch for 2 pax', 4500, 'paid', 'completed', 'Marco'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'ORD-2025-002', 'Airport Transfer', 'Private van transfer from Sayak Airport', 1500, 'pending', 'new', 'Juan')
on conflict (id) do nothing;

-- Tasks
insert into public.tasks (id, business_id, customer_id, title, description, due_date, priority, status) values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'Confirm airport transfer for John Carter', 'Contact driver Marco to confirm pickup at Sayak Airport.', (now() + interval '2 days')::date, 'high', 'todo'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Prepare anniversary package for Maria Santos', 'Arrange flowers, chocolate, and wine in Room 101.', (now() + interval '1 day')::date, 'medium', 'in_progress'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', null, 'Update room inventory spreadsheet', 'Add new room photos and update amenity list.', (now() + interval '3 days')::date, 'low', 'todo')
on conflict (id) do nothing;

-- Leads
insert into public.leads (id, business_id, name, company, phone, email, source, stage, estimated_value, next_action, assigned_staff) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', 'Alex Thompson', 'Thompson Travel Co.', '+1 555 9876', 'alex@thompsontravel.com', 'Website', 'qualified', 45000, 'Send group booking proposal', 'Ana Reyes'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000001', 'Lisa Chen', null, '+65 9123 4567', 'lisa.chen@gmail.com', 'Instagram', 'contacted', 18000, 'Follow up on DM inquiry', 'Ana Reyes'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000001', 'Rina Patel', 'Patel Hospitality Group', '+91 98765 43210', 'rina@patelhg.com', 'Referral', 'new', 120000, 'Schedule introductory call', 'Ana Reyes')
on conflict (id) do nothing;

-- Settings
insert into public.settings (business_id, key, value) values
  ('00000000-0000-0000-0000-000000000001', 'booking_terms', 'Cancellations within 48 hours subject to one night charge.'),
  ('00000000-0000-0000-0000-000000000001', 'check_in_time', '14:00'),
  ('00000000-0000-0000-0000-000000000001', 'check_out_time', '12:00')
on conflict (business_id, key) do nothing;
