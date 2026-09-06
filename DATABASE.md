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
│   ├── 010_tenant_isolation.sql   # each signup gets their own business
│   ├── 011_message_delivery.sql
│   ├── 012_resources.sql
│   ├── 013_booking_items.sql
│   ├── 014_booking_check_in_out.sql
│   ├── 015_multi_day_dates.sql
│   ├── 016_create_avatars_bucket.sql
│   ├── 017_team_invites.sql      # multi-member teams via invite token
│   └── 018_multi_business.sql    # multi-business memberships, switcher, admin-created accounts, self-serve leave
├── rls/
│   ├── tenant_isolation.test.sql            # adversarial tenant-isolation test
│   ├── run-tenant-isolation-test.ps1        # Windows runner
│   └── run-tenant-isolation-test.sh         # mac/Linux runner
├── invites/
│   ├── team_invite.test.sql                 # team-invite behavior + RLS test
│   ├── run-team-invite-test.ps1             # Windows runner
│   └── run-team-invite-test.sh              # mac/Linux runner
├── membership/
│   ├── multi_business.test.sql              # multi-business behavior + RLS test
│   ├── run-multi-business-test.ps1          # Windows runner
│   └── run-multi-business-test.sh           # mac/Linux runner
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
| `bookings` | Reservations/appointments (resource, date + optional end_date span, time window, guests, status, payment) |
| `orders` | Sales orders (number, optional start/end dates, status, payment, total) |
| `tasks` | To-dos with due date, priority, status, assignee |
| `leads` | Sales pipeline leads with stage and estimated value |
| `activities` | Immutable activity/audit log entries |
| `notifications` | Per-user notifications |
| `settings` | Generic per-business key/value settings (preferences) |
| `follow_ups` | Follow-up reminders attached to customers (status, due date) |
| `message_templates` | Reusable email/SMS templates per business |
| `communications` | Customer message ledger (template + subject + body per send) |
| `invitations` | Pending/accepted team invites (email, target role, unguessable token, TTL) |
| `user_current_business` | Active business per user (1 row per user) — written at membership creation, changed via `switch_business()`/`leave_business()` |

## Indexes

Every table has helpful lookups on `business_id` plus columns used in filters/sorts and time ranges — e.g. `idx_bookings_date`, `idx_bookings_status`, `idx_orders_created_at`, `idx_tasks_due_date`, `idx_leads_stage`, `idx_activities_created_at`.

## Triggers

- `updated_at` triggers maintain timestamps on writable tables.
- `on_auth_user_created` provisions accounts at signup (migrations 017–018):
  - **Admin-created accounts** (`raw_user_meta_data.admin_created`, from the `admin_create_member` RPC) — the trigger returns early; provisioning is handled by the RPC itself so no phantom business is minted.
  - **Without an invite token** — creates a fresh `businesses` + `profiles` row (owner) and records it as the active business (migration 010 behavior).
  - **With a valid `invite_token`** (from `/signup?invite=<token>`) — validates the token against `invitations` (`for update` to serialize concurrent use), attaches the new profile to the **inviter's business** with the invited role, makes it the active business, consumes the invite (sets `accepted_at`/`accepted_user_id`), and notifies the inviter. Invalid/expired/revoked/used/mismatched-email tokens **abort the signup**.
- `profiles_protect_last_owner` blocks deleting or demoting a business's **last owner** (migration 017). This also protects `leave_business()` — a sole owner cannot leave.

## Security helpers & RPCs (multi-business, migration 018)

- `current_business_id()` — the RLS anchor. Reads the `user_current_business` preference first and falls back to the user's single membership. Now a **security definer** function (no RLS recursion); created with `create or replace` so dependent policies survive.
- `get_current_business()` — the only way the client discovers the active business; never drifts from RLS.
- `switch_business(business_id)` — flips the active business; **rejects** any business the caller is not a member of.
- `accept_invite(token)` — lets an **existing account** claim a pending invite (the `/signup?invite=` link with "Sign in"): validates + consumes the invite, adds the membership, switches the active business, notifies the inviter. Rejected if already a member or the invite is invalid/consumed.
- `admin_create_member(first_name, last_name, email, password, role)` — creates a **confirmed account directly** (or attaches an existing account) to the caller's active business. Gated by `current_user_can_invite` (owners any role, managers anything but owner). No business is created.
- `leave_business()` — removes the caller from their active business; moves the preference to a remaining membership or clears it.

## Row Level Security

RLS is the backbone of multi-tenancy. Each business is isolated by a `current_business_id()` helper (see RPCs above — preference row first, single membership as fallback), and all rows are scoped to that business.

Key policies:

- **profiles**: users can select/update their own row and rows within their business; owners can manage business-wide profiles.
- **business-scoped tables** (`customers`, `bookings`, `orders`, `tasks`, `leads`, `activities`, `settings`, `follow_ups`, `message_templates`, `communications`): a shared template grants `select`/`insert`/`update`/`delete` **only when `business_id = current_business_id()`**.
- **notifications**: users only see/update/delete their own rows.
- **invitations** (migration 017): `select` scoped to the business; `insert`/`delete` gated by `current_user_can_invite(role)` — owners may invite any role, managers may invite `manager`/`staff` but never `owner`. Guests may only read an invite's summary via the `get_invite_summary(token)` RPC (business name + inviter), which requires a valid pending token.
- **`user_current_business`** (migration 018): RLS is enabled but has **no direct policies** — only the security definer RPCs/trigger touch it, so the client can never read or forge another user's active-business preference.

This means the anon/authenticated Supabase client used by the app can never read or write another business's data, even if a malformed query is issued.

## Verifying tenant isolation (adversarial RLS test)

`supabase/rls/tenant_isolation.test.sql` is a **P0 security gate**: it actively tries to break tenant isolation and fails loudly if any RLS policy leaks. Run it whenever RLS/migrations change and before deploys.

What it does:

1. Creates two real tenants through the production signup trigger (migration 010) and seeds Tenant B with one row in **every** RLS-protected table (businesses, profiles, customers, customer_notes, bookings, booking_items, orders, tasks, leads, activities, message_templates, communications, follow_ups, resources, settings, notifications, invitations, user_current_business).
2. Impersonates Tenant A (`set local role authenticated` + forged JWT claims) — the canonical Supabase technique.
3. Attempts `SELECT`/`UPDATE`/`DELETE` on every Tenant B row **by ID**. Each attempt must affect zero rows; any leak raises an exception and stops the run.
4. Includes control checks that prove the impersonation really is Tenant A (reads its own business + profile), so a green result is meaningful.
5. Rolls back, leaving no data behind.

Requires a role that bypasses RLS (postgres/supabase_admin), and migrations `001`–`018`.

```bash
# mac / Linux
./supabase/rls/run-tenant-isolation-test.sh "$DATABASE_URL"

# Windows PowerShell
.\supabase\rls\run-tenant-isolation-test.ps1 -ConnectionString $env:DATABASE_URL
```

If the test fails, fix the flagged RLS policy **before any other work** — this is a P0 security gate, not a backlog item.

**Two other RLS surfaces are intentionally outside this table-level test:**

- **Storage objects** — the public `avatars` bucket (migration `016`) is protected by policies in the `storage` schema, not the public tables. Bucket visibility is intended to be public; re-validate `storage.objects` policies separately if that ever changes.
- **Edge Functions** — `send-invite` / `send-message` run with the service role and **bypass RLS by design**. They re-authenticate the caller and scope work to the caller's own business inside the function; review that authorization whenever the functions change. The invite/message tests (`supabase/invites`, `supabase/membership`) exercise the RPC surface, not the function bodies.

## Verifying the team-invite flow (behavior + RLS test)

`supabase/invites/team_invite.test.sql` is a **P1 security gate** for multi-member teams (migration 017). It exercises the invitation chain end to end and fails loudly if any reject path leaks:

1. **Valid token** — an invitee signs up with the invite token and must land in the inviter's business with the invited role; no new business is created; the invite is consumed; the inviter is notified.
2. **Role gating** — a manager (as `authenticated` with forged JWT claims) can create a `staff` invite but an `owner` invite must be silently filtered by RLS (0 rows).
3. **Reject paths** — mismatched email, unrecognized token, expired invite, revoked invite, and reused token must all abort the signup (the trigger raises).
4. **Default signup** — a signup without a token still creates a fresh business (migration 010 behavior unchanged).
5. **Last-owner guard** — the sole owner cannot be demoted or deleted; once a second owner exists, demotion succeeds.

Requires a role that bypasses RLS (postgres/supabase_admin) and migrations `001`–`017`.

```bash
# mac / Linux
./supabase/invites/run-team-invite-test.sh "$DATABASE_URL"

# Windows PowerShell
.\supabase\invites\run-team-invite-test.ps1 -ConnectionString $env:DATABASE_URL
```

## Verifying multi-business membership (behavior + RLS test)

`supabase/membership/multi_business.test.sql` is a **P1 security gate** for migration 018. It exercises the multi-membership model end to end and fails loudly if any reject path leaks:

1. **Active-business record** — every new membership (default signup + invite join) sets `user_current_business`; `current_business_id()`/`get_current_business()` follow it.
2. **Second membership** — an existing account accepts an invite with `accept_invite()` and gains a second membership in a different business.
3. **Switching** — `switch_business()` flips the active business **and** RLS scopes all reads to it; switching to a non-member business is rejected.
4. **Single-use invites** — a second `accept_invite()` with a consumed token is rejected.
5. **Admin-created accounts** — `admin_create_member()` mints a confirmed account (no phantom business, `admin_created` passthrough honored, prefs set); a manager cannot mint an owner; attaching an existing member is rejected.
6. **Leaving** — `leave_business()` drops the active membership, moves the preference to a remaining business, and clears it entirely at the last membership.
7. **Owner guard** — the sole owner cannot leave their business.

Requires a role that bypasses RLS (postgres/supabase_admin) and migrations `001`–`018`.

```bash
# mac / Linux
./supabase/membership/run-multi-business-test.sh "$DATABASE_URL"

# Windows PowerShell
.\supabase\membership\run-multi-business-test.ps1 -ConnectionString $env:DATABASE_URL
```

## Applying the schema

Run the SQL in `supabase/migrations/` **in order** (`001` → `018`) in the Supabase SQL editor, then optionally `supabase/seed.sql` (skip in production).

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Supabase setup steps.
