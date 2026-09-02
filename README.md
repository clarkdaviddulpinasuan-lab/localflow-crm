# LocalFlow CRM

A portfolio-quality CRM and business operations platform built for small hospitality and local businesses — resorts, hotels, restaurants, cafes, sari-sari stores, and more. Track customers, bookings, orders, tasks, leads, and revenue from one dashboard.

Built with **React 19 + TypeScript + Vite + Tailwind CSS 4**, backed by **Supabase** (PostgreSQL + RLS) with a fully functional **demo mode** that requires no backend. Deploys as a static site (or installable PWA) to any host — Vercel, Netlify, Cloudflare Pages, GitHub Pages.

---

## ✨ Features

- **Dashboard** — KPI cards with trend deltas, revenue/customer charts, business health, upcoming reservations, recent activity
- **Calendar** — month / week / day views combining bookings and tasks into a single timeline
- **Customers** — directory with search, filters, sort, CSV export, and a rich profile page (notes, bookings, orders, activity timeline)
- **Bookings / Orders** — business-type-aware resources, status + payment tracking, deep-links to customers
- **Tasks** — overdue highlighting, priority + status filters, quick complete
- **Leads** — pipeline stages with estimated value tracking
- **Segments** — data-driven customer personas (high-value, loyal, at-risk, inactive, new, prospect) with stats
- **Tasks & Leads boards** — kanban-style boards with per-card stage moves (keyboard accessible, no drag required)
- **Insights** — rule-based observations generated from live data (revenue trends, repeat rate, risk items)
- **Saved views** — per-page filter/sort presets persisted in the browser
- **Dashboard customization** — toggle the KPI/chart/health/insights/activity widgets on the overview
- **Automation** — configure rule triggers (overdue tasks, upcoming/unconfirmed bookings, inactive customers, new leads) that create tasks, follow-ups, notifications, or activity logs; events fire once thanks to a Nonce in the activity trail and rules re-read live data on every run
- **Templates & Communications** — reusable email/SMS templates with placeholders plus a per-customer message ledger (message customers straight from their profile)
- **Availability** — per-resource slot grid generated from working hours, with booked slots flagged
- **Follow-ups** — pending/completed/skipped reminders attached to customers
- **White-label ready** — tenant-level instance config: app name, custom domain, brand accent color, and feature switches
- **Reports** — date-range sales, charts, booking/payment breakdowns, customer retention, CSV export
- **Team & Roles** — owner / manager / staff permissions; invite and manage teammates; role-based UI gating
- **Settings** — business profile, personal preferences, notification controls, data & safety (demo reset)
- **Responsive + accessible** — mobile-first layouts, keyboard + screen-reader friendly, reduced-motion support

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm

### Install & run

```bash
npm install
npm run dev        # start the dev server at http://localhost:5173
```

By default the app runs in **demo mode** (no backend needed). All data is stored locally in your browser.

### Production build

```bash
npm run build       # type-check + build to dist/
npm run preview     # preview the production build
```

### Tests & lint

```bash
npm test            # run the Vitest suite (utils, services, components, permissions)
npm run test:coverage
npm run lint        # ESLint
```

---

## 🔌 Connecting Supabase

1. Create a project at [app.supabase.com](https://app.supabase.com) and grab your URL + anon key.
2. Run the migrations in `supabase/migrations/` in order (1 → 10) via the SQL Editor, or `supabase db push`.
3. Copy `.env.example` to `.env` and set your credentials:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_DEMO_MODE=false
   ```

4. Restart the dev server.

> **Multi-tenant by design:** every account that signs up gets its own isolated
> business. No business ever sees another's data (enforced by Row Level Security).

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [DATABASE.md](./DATABASE.md) for full instructions.

---

## 🗂 Project Structure

```
src/
├── components/     # UI primitives (Button, Card, Modal, Badge, ...) + KpiCard
├── contexts/       # Auth, Business (type-aware terminology)
├── data/           # demo dataset ("Siargao Breeze Resort")
├── pages/          # feature pages (customers, bookings, orders, tasks, ...)
├── routes/         # ProtectedRoute
├── services/       # data layer (demo store backed, Supabase-ready)
├── utils/          # format, query, csv, calendar, permissions, cn
└── types/          # domain models + schema documentation
supabase/           # schema (SQL), RLS, seed
```

The architecture is intentionally layered so the demo store can be swapped for Supabase without touching UI code. See [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 📁 Deployment

`npm run build` emits a static site to `dist/`. It deploys anywhere that serves static files — **Vercel** (a `vercel.json` SPA rewrite is included), Netlify, Cloudflare Pages, GitHub Pages, etc. It's also a PWA: `manifest.webmanifest`, icons, and a service worker (`public/sw.js`) enable install-to-home-screen.

See [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, data flow, demo ↔ Supabase swap
- [DATABASE.md](./DATABASE.md) — schema, enums, indexes, triggers, RLS policies
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploying to Vercel + wiring Supabase
- [CONTRIBUTING.md](./CONTRIBUTING.md) — setup, conventions, testing

---

## License

Private/portfolio project. © 2026
