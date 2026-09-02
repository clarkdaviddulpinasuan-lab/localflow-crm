# Supabase

This folder contains everything needed to stand up the LocalFlow CRM backend on Supabase (PostgreSQL with Row Level Security).

| File | Purpose |
| --- | --- |
| `migrations/001_init.sql` | Base schema: tables, enums, indexes, `updated_at` + auth triggers, and full RLS policies |
| `migrations/002_backfill_profiles.sql` | Backfill missing profiles for existing auth users |
| `migrations/003_backfill_visit_count.sql` | Backfill customer visit counts |
| `migrations/004_business_config.sql` | Default `dashboard_config` settings row per business |
| `migrations/005_add_business_types.sql` | Extra `business_type` enum values (homestay, salon, …) |
| `migrations/006_add_task_waiting.sql` | `task_status` enum value `waiting` |
| `migrations/007_create_follow_ups.sql` | Follow-up queue table + RLS |
| `migrations/008_create_templates_communications.sql` | Message templates + communications ledger + RLS |
| `migrations/009_link_orders_to_bookings.sql` | `orders.booking_id` column + index |
| `migrations/010_tenant_isolation.sql` | Each signup gets its own isolated business (multi-tenant) |
| `apply_latest.sql` | Concatenation of migrations 007→010 — paste into the SQL editor if your project was set up before those shipped |
| `seed.sql` | Sample dataset — the "Siargao Breeze Resort" business, profiles, customers, bookings, orders, tasks, leads, activities, notifications |
| `reset.sql` | Drops all objects and recreates them for a clean environment |

## Applying

1. Open the **Supabase dashboard → SQL Editor**.
2. Paste & run the migration files **in order** (`001` → `010`), or use the Supabase CLI: `supabase db push`.
3. (Optional) Run `seed.sql` for sample data — useful for development and demo previews. In production, skip it so each new account starts clean.

The migrations are idempotent (safe to re-run) thanks to `create table if not exists`, guarded `do $$ ... exception when duplicate_object` blocks, and `create index if not exists`.

## Row Level Security

RLS is enabled on every table. Rows are scoped to a business via the `current_business_id()` helper (derived from the authenticated user's profile), so clients can never read or write outside their own organization. See [DATABASE.md](../../DATABASE.md) for the policy breakdown.

The Supabase **anon key** is safe to expose in the frontend because every table is protected by RLS and the policies only grant access to the caller's own business.

## Local development using the Supabase CLI (optional)

If you'd like a local Postgres:

```bash
supabase init
supabase start
supabase db reset
supabase migration up
```

Then point your `.env` at the local Supabase URL/anon key.
