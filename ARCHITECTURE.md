# Architecture

LocalFlow CRM is a single-page React application organized into clean layers so the data layer can be swapped between an in-memory **demo store** and **Supabase** without touching any UI code.

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

- `demoStore.ts` — an in-memory + `localStorage`-persisted store (`localflow:crm:demo:v1`)
- Per-domain services (`customerService`, `bookingService`, `orderService`, `taskService`, `leadService`, `calendar`, `notificationService`, `dashboardService`, `reportService`, `settingsService`)

Pages import service functions (e.g. `listCustomers`, `createBooking`) — **never** `localStorage` or Supabase directly.

### Demo ↔ Supabase swap

A single developer-facing flag controls the backend:

- `VITE_DEMO_MODE=true` (default) — services read/write the demo store, fully interactive in the browser with no backend.
- `VITE_DEMO_MODE=false` — services call Supabase (`src/lib/supabase.ts`).

The Supabase client is intentionally **untyped** at the binding level; domain type safety is enforced through the models in `src/types/index.ts`. The generated-equivalent schema documentation lives in `src/types/database.ts` (documentation only).

### Example flow — creating a booking

1. **UI**: `BookingsPage` renders `BookingForm`, collects input.
2. **Service**: `createBooking({...})` in `bookingService.ts` builds a `Booking`, writes to the store, and logs an activity.
3. **State**: In demo mode this mutates `demoStore`; in prod this would `insert` into Supabase (which enforces RLS).
4. **Activity log**: The service also records an `Activity` entry so recent-activity feeds stay consistent.

## State & Persistence

- **Auth/Profile/Business**: provided via `AuthContext` (demo identity or Supabase session).
- **Business context**: `BusinessContext` adapts terminology (e.g. Bookings vs Reservations vs Orders, Room vs Table) based on the business type.
- **Domain data**: loaded fresh from services on each render / interaction; no global Redux/Zustand — deliberately simple and explicit.

## Accessibility & Performance

- Panels use semantic landmarks, keyboard-focus rings, and ARIA attributes (`role="switch"`, `aria-checked`, labels).
- A `prefers-reduced-motion` media query disables animations in `src/index.css`.
- Routes are **code-split** with `React.lazy` + `Suspense` in `src/AppRoutes.tsx`, keeping the initial bundle small (Recharts and Supabase load on demand).
