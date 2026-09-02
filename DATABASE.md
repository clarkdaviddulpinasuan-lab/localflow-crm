# Database

LocalFlow CRM uses **Supabase (PostgreSQL)** as its production backend. The complete schema, row-level security (RLS), triggers, and seed data are defined in [`supabase/`](./supabase/).

```
supabase/
├── migrations/
│   ├── 001_init.sql          # base schema + enums + indexes + triggers + RLS
│   ├── 002_backfill_profiles.sql
│   ├── 003_backfill_visit_count.sql
│   ├── 004_business_config.sql
│   ├── 005_add_business_types.sql
│   ├── 006_add_task_waiting.sql
│   ├── 007_create_follow_ups.sql
│   ├── 008_create_templates_communications.sql
│   ├── 009_link_orders_to_bookings.sql
│   └── 010_tenant_isolation.sql   # each signup gets their own business
├── seed.sql           # sample business ("Siargao Breeze Resort") + data
└── reset.sql          # drop & recreate everything for a clean slate
```

The migrations are **idempotent** — you can run them multiple times safely.

## Enums

| Enum | Values |
| --- | --- |
| `user_role` | `owner`, `manager`, `staff` |
| `business_type` | `hotel`, `resort`, `guesthouse`, `restaurant`, `cafe`, `sari_sari`, `retail`, `service`, `other` |
| `customer_status` | `new`, `active`, `vip`, `inactive` |
| `customer_type` | `guest`, `local`, `corporate`, `regular`, `walk_in` |
| `booking_status` | `pending`, `confirmed`, `checked_in`, `completed`, `cancelled`, `no_show` |
| `payment_status` | `paid`, `pending`, `partial`, `refunded` |
| `order_status` | `new`, `processing`, `completed`, `cancelled` |
| `task_priority` | `low`, `medium`, `high`, `urgent` |
| `task_status` | `todo`, `in_progress`, `waiting`, `completed` |
| `lead_stage` | `new`, `contacted`, `qualified`, `proposal`, `won`, `lost` |
| `notification_type` | `booking`, `task`, `payment`, `lead`, `customer`, `system` |
| `follow_up_status` | `pending`, `completed`, `skipped` |
| `template_channel` | `email`, `sms` |
| `communication_status` | `sent`, `failed` |

## Tables

| Table | Purpose |
| --- | --- |
| `businesses` | Business entities (name, type, location, currency, timezone, team_size) |
| `profiles` | User profiles linked to `auth.users` and a business; each has a `role` |
| `customers` | Customer records (contact info, type, status, spend, visits) |
| `customer_notes` | Notes attached to customers |
| `bookings` | Reservations/appointments (resource, date, time window, guests, status, payment) |
| `orders` | Sales orders (number, status, payment, total) |
| `tasks` | To-dos with due date, priority, status, assignee |
| `leads` | Sales pipeline leads with stage and estimated value |
| `activities` | Immutable activity/audit log entries |
| `notifications` | Per-user notifications |
| `settings` | Generic per-business key/value settings (preferences) |
| `follow_ups` | Follow-up reminders attached to customers (status, due date) |
| `message_templates` | Reusable email/SMS templates per business |
| `communications` | Customer message ledger (template + subject + body per send) |

## Indexes

Every table has helpful lookups on `business_id` plus columns used in filters/sorts and time ranges — e.g. `idx_bookings_date`, `idx_bookings_status`, `idx_orders_created_at`, `idx_tasks_due_date`, `idx_leads_stage`, `idx_activities_created_at`.

## Triggers

- `updated_at` triggers maintain timestamps on writable tables.
- `on_auth_user_created` automatically provisions a business + `profiles` row when a new Supabase auth user signs up. **Each signup creates a fresh, private business** — the app is multi-tenant by default (migration 010).

## Row Level Security

RLS is the backbone of multi-tenancy. Each business is isolated by a `current_business_id()` helper (set from the user's profile), and all rows are scoped to that business.

Key policies:

- **profiles**: users can select/update their own row and rows within their business; owners can manage business-wide profiles.
- **business-scoped tables** (`customers`, `bookings`, `orders`, `tasks`, `leads`, `activities`, `settings`, `follow_ups`, `message_templates`, `communications`): a shared template grants `select`/`insert`/`update`/`delete` **only when `business_id = current_business_id()`**.
- **notifications**: users only see/update/delete their own rows.

This means the anon/authenticated Supabase client used by the app can never read or write another business's data, even if a malformed query is issued.

## Applying the schema

Run the SQL in `supabase/migrations/` **in order** (`001` → `010`) in the Supabase SQL editor, then optionally `supabase/seed.sql` (skip in production).

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Supabase setup steps.
