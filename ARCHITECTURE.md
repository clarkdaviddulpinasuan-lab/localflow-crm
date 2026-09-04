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

Every service queries Supabase through the single client in `src/lib/supabase.ts`, which is configured from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and throws at module load if either is missing (there is no offline fallback).

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

## Accessibility & Performance

- Panels use semantic landmarks, keyboard-focus rings, and ARIA attributes (`role="switch"`, `aria-checked`, labels).
- A `prefers-reduced-motion` media query disables animations in `src/index.css`.
- Routes are **code-split** with `React.lazy` + `Suspense` in `src/AppRoutes.tsx`, keeping the initial bundle small (Recharts and Supabase load on demand).
