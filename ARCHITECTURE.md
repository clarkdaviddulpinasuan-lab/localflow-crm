# Architecture

LocalFlow CRM is a single-page React application organized into clean layers. All data flows through the service layer, which talks to **Supabase** (PostgreSQL + RLS). No UI code touches storage directly.

## Technology Stack

| Layer | Choice |
| --- | --- |
| UI framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Styling | Tailwind CSS 4 (design tokens in `src/index.css`) |
| Charts | Recharts |
| Date handling | date-fns |
| Backend | Supabase (PostgreSQL + Row Level Security) |
| Testing | Vitest + Testing Library |

## Layer Overview

```
src/
├── pages/            Feature screens (dumb-ish; orchestrate services)
├── components/       Reusable UI primitives + feature-specific pieces
├── contexts/         React context providers (Auth, Business)
├── services/         Data-access layer — the ONLY place that touches storage
├── utils/            Pure, testable helpers
├── data/             Demo dataset
├── types/            Domain models + schema documentation
```

### The data layer (key design decision)

All reads/writes to persistent state flow through **services** in `src/services/*`:

- Per-domain services (`customerService`, `bookingService`, `orderService`, `taskService`, `leadService`, `calendar`, `notificationService`, `dashboardService`, `reportService`, `settingsService`)

Pages import service functions (e.g. `listCustomers`, `createBooking`) — **never** `localStorage` or Supabase directly.

### Supabase-only data layer

Every service queries Supabase through the single client in `src/lib/supabase.ts`, which is configured from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and throws at module load if either is missing.

Row-level security (migration `001`) scopes every query to the signed-in user's business, so services stay simple and per-user isolation is enforced by the database.

Tests exercise services against an in-memory Supabase mock (`src/test/supabaseMock.ts`) seeded from the sample dataset in `src/data/demo.ts` — the same code paths used in production.

The Supabase client is intentionally **untyped** at the binding level; domain type safety is enforced through the models in `src/types/index.ts`. The generated-equivalent schema documentation lives in `src/types/database.ts` (documentation only).

### Example flow — creating a booking

1. **UI**: `BookingsPage` renders `BookingForm`, collects input.
2. **Service**: `createBooking({...})` in `bookingService.ts` builds a `Booking`, inserts it into Supabase, and logs an activity.
3. **State**: Inserted into `bookings`; RLS confines it to the caller's business.
4. **Activity log**: The service also records an `Activity` entry so recent-activity feeds stay consistent.

## State & Persistence

- **Auth/Profile/Business**: provided via `AuthContext` (Supabase session).
- **Business context**: `BusinessContext` adapts terminology (e.g. Bookings vs Reservations vs Orders, Room vs Table) based on the business type.
- **Domain data**: loaded fresh from services on each render / interaction; no global Redux/Zustand — deliberately simple and explicit.

## Multi-member teams (invite model)

A business is no longer single-user. Team members get **their own accounts, logins, and profiles** while sharing one business dashboard (`supabase/migrations/017_team_invites.sql`):

- An owner/manager creates an **invitation** (`invitations` table: email, role, one-time unguessable `token`, 7-day TTL). The **only** way into an existing business is a valid pending invite consumed server-side by the signup trigger — no client code can join or mint membership directly.
- `src/services/settingsService.ts` is the client gateway: `createInvite`, `listPendingInvites`, `revokeInvite` (plus `listTeam`/`updateTeamMember`/`removeTeamMember` for existing members). The previous `addTeamMember` (inserting a `profiles` row without a `user_id`) was removed — it only worked against the test mock and violated the real schema.
- `SignupPage` reads `?invite=<token>`, shows a best-effort summary via the `get_invite_summary` RPC, and passes `invite_token` in `options.data`.
- Role gating is enforced **in the database** (`current_user_can_invite`): owners invite any role; managers never invite `owner`. A `protect_last_owner` trigger keeps at least one owner per business.
- Revoked access: when a signed-in user's `profiles` row is gone (removed by the owner), `AuthContext` reports `accessRevoked` and `ProtectedRoute` renders an "Access revoked" screen with Sign out.
- The invite link is **emailed automatically** on creation (and via per-invite Resend) by the `send-invite` Edge Function (`supabase/functions/send-invite`), which reuses the shared Resend/dry-run delivery path. The client supplies the final link from its own origin and falls back to Copy-link in the UI when the send fails.
- An invitee who **already has an account** signs in from the invite link and claims it: `SignupPage` auto-accepts for signed-in sessions, and `LoginPage` accepts the pending token after a successful sign-in (token carried via `?invite=` and `sessionStorage`), both through the `accept_invite` RPC.

## Multi-business membership, admin-created accounts & self-serve leave (018)

One account can belong to **several businesses** and switch between them (`supabase/migrations/018_multi_business.sql`):

- **Active business**: a per-user row in `user_current_business` (written at membership creation). The RLS anchor `current_business_id()` reads it first, falling back to the lone membership. Clients discover it via the `get_current_business` RPC — `dataClient.getCurrentBusinessId` now uses the RPC instead of guessing from `profiles`, so resolution can never drift from RLS.
- **Switching**: `switch_business(business_id)` (validates membership server-side) flips the preference; `AuthContext` exposes `memberships` (all of the user's profiles) + `switchBusiness`, and the sidebar shows a **business switcher** dropdown when the user belongs to more than one. Services (`getProfile`, `updateProfile`, `listTeam`) now filter by the active business.
- **Admin-created accounts**: `admin_create_member(...)` RPC mints a **confirmed** auth account directly (password set), attaches it to the caller's active business with the chosen role, and records its active business — or attaches an existing account. The signup trigger short-circuits on the `admin_created` marker so no phantom business is created. Team page's "Add a Team Member" modal offers Invite-by-link or Create-account.
- **Self-serve leave**: `leave_business()` removes the caller from the active business; the preference moves to a remaining membership or clears. The last-owner trigger keeps an owner from leaving their only business. The Team page shows a **Leave** control (disabled for a sole owner).
- Previously deferred items are now shipped: migration 018 ships multi-business membership AND admin-created accounts AND self-removal. Attaching an already-registered account is covered by both `accept_invite` and `admin_create_member`'s attach path.

## Accessibility & Performance

- Panels use semantic landmarks, keyboard-focus rings, and ARIA attributes (`role="switch"`, `aria-checked`, labels).
- A `prefers-reduced-motion` media query disables animations in `src/index.css`.
- Routes are **code-split** with `React.lazy` + `Suspense` in `src/AppRoutes.tsx`, keeping the initial bundle small (Recharts and Supabase load on demand).
- Connectivity resilience (see `src/lib/withRetry.ts`, `src/lib/fetchWithTimeout.ts`, `src/components/OfflineBanner.tsx`): a global banner reports offline/online transitions, every Supabase request rides a 15s hard timeout so a hung connection fails loudly instead of hanging forever, and read-bound services retry transient failures (fetch/timeout/reset) with backoff. Writes are intentionally **not** retried to avoid duplicate rows; an offline-first write queue remains a future item.
- Retry policy is *reads only*: every list query, single-record getter, settings/config read (`settings`-keyed: automation rules, dashboard config, messaging config, instance config), notifications/unread count, templates, follow-ups, booking items, communications, customer notes, order-number reads, and business resolution / stats recalc reads retry transient failures; `insert`/`update`/`delete` and state-changing RPCs never do.
- Ambiguous-failure caveat for writes: a multi-step service call (e.g. `createBooking`) can complete its write yet fail on a follow-up (activity log, stats recalc, which are not retried). The page then reports an error although the row persisted — so pages should refetch, not re-submit, on a reported failure.

### Bundle / first-load budget

Measured on the current tree (`vite build`, `dist/assets`), targets shown for context:

| Asset | Size | gzip | Loaded when | Budget |
| --- | --- | --- | --- | --- |
| `index-*.js` (entry) | 273.3 kB | 86.7 kB | initial | < 250 kB gzip |
| `supabase-*.js` | 208.7 kB | 54.0 kB | on demand | lazy-isolated |
| `LineTrendChart-*.js` (Recharts) | 376.6 kB | 108.8 kB | on demand | lazy-isolated |
| `index-*.css` | 45.2 kB | ~8.6 kB | initial | — |

Initial gzipped JS ≈ **86.7 kB**, well under the 250 kB budget. The offline/error-boundary work added only ~1.2 kB gzipped to the entry chunk; the Supabase and Recharts chunks are byte-identical to the pre-change baseline. If Recharts ever grows further, swap the overview trend for a lighter chart.
