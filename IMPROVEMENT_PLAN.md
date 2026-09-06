# LocalFlow CRM — Hardening Master Prompt

This is a planning document, not a task list to execute yet. It's written so it can be
handed to an engineer (or an AI agent, one item at a time) as a self-contained prompt.
Each section has enough context to act on without re-reading the whole codebase from
scratch. Work top-to-bottom — later items assume earlier ones are done.

Do not start implementation from this document alone — pick one numbered item, confirm
scope, then execute it in its own branch/PR so each change is reviewable independently.

---

## 0. Ground rules for whoever executes this

- Services in `src/services/` are the only code allowed to talk to Supabase. Pages and
  components consume services — never add a raw `supabase.from(...)` call to a page.
- Don't add abstractions beyond what each item needs. No new state-management library,
  no new UI kit — extend what's already there (Tailwind 4, the `src/components/ui`
  primitives, the existing service pattern).
- Every item below must ship with a test where the codebase already has a test
  pattern for that kind of thing (services and utils have Vitest coverage — match it).
- Don't touch unrelated files. Each item is scoped; resist the urge to refactor
  neighboring code "while you're in there."
- Run `npx tsc --noEmit` and `npm test` before calling any item done.

---

## 1. Error boundary (highest priority, smallest effort)

**Problem:** There is no `ErrorBoundary` anywhere in the component tree
(`src/App.tsx`, `src/AppRoutes.tsx`). A single unhandled render exception — a bad
Supabase payload shape, a null a page didn't expect — currently white-screens the
entire app with no recovery path and no record of what happened.

**Fix:**
- Add a top-level `ErrorBoundary` class component (React error boundaries still
  require a class component) in `src/components/ErrorBoundary.tsx`.
- Wrap the router output in `App.tsx` with it.
- On catch: render a friendly fallback (reuse the visual language of
  `src/components/ui/EmptyState.tsx` — don't invent a new empty-state pattern) with a
  "Reload" action, and log the error (console.error is fine for now — no telemetry
  vendor is wired up, don't add one as part of this item).
- Consider a second, smaller boundary around the router's outlet per major layout
  section (e.g. inside `AppLayout.tsx`) so one broken page doesn't take out the
  sidebar/nav — optional, only do this if the top-level boundary alone feels too
  coarse once you see it in action.

**Acceptance criteria:** Throwing inside any one page component (test this manually,
temporarily, by throwing in `OverviewPage.tsx`) shows the fallback UI, not a blank
screen, and the rest of the app (sidebar, header) either still renders or the whole
shell offers a reload — pick whichever the boundary placement above lands you on, but
be deliberate about which.

---

## 2. Offline / connectivity resilience (the one the user most wants fixed)

**Problem:** The README states plainly: "the app requires real credentials — there is
no offline mode." In practice this means: no retry/backoff on failed Supabase calls,
no visible "you're offline" state, and no defined behavior when a request times out or
Supabase is briefly unreachable (mobile networks, the Philippines market this app is
demoed for). Today a flaky connection likely looks identical to a real error, or hangs
silently.

This does **not** mean "make the app work fully offline with local writes and sync" —
that's a much bigger architecture change (local-first data layer, conflict resolution)
and is explicitly out of scope unless you decide later you want it. Scope this item as
**graceful degradation and recovery**, not offline-first.

**Fix, in three layers:**

1. **Network status awareness.**
   Add a small hook (`src/lib/useOnlineStatus.ts` or similar) wrapping
   `navigator.onLine` + the `online`/`offline` window events. Surface it as a
   persistent, dismissible-but-reappearing banner (fits next to the existing
   demo-mode banner pattern — check how that's implemented in `LoginPage.tsx` /
   wherever "Show demo-mode banner on login page only when demo mode is on" landed,
   per recent commit history, and reuse that placement convention) saying something
   like "You're offline — changes won't save until you're back online."

2. **Retry with backoff on transient failures.**
   Audit `src/services/dashboardService.ts` (the largest and most-called service,
   574 lines, drives the whole Overview page) first as the pilot. Identify every
   Supabase call it makes. Wrap the actual `supabase.from(...)` / `.rpc(...)` calls in
   a small shared helper — e.g. `src/lib/withRetry.ts` — that retries transient
   network failures (fetch failed / timeout — NOT 4xx auth or RLS-denied errors,
   which should fail immediately and visibly) 2–3 times with exponential backoff
   (e.g. 500ms, 1500ms, 4000ms). Once this helper exists and is proven on
   `dashboardService.ts`, roll it out to the other services in a follow-up pass —
   don't do all of them in one PR.

3. **Defined loading/error/empty states, consistently.**
   Before touching individual pages, check whether `src/components/ui/Skeleton.tsx`,
   `EmptyState.tsx`, and any existing error-state pattern already cover
   loading/error/empty — the goal is *consistency*, not new components. Every page
   that calls a service should visibly distinguish "loading," "loaded with no data,"
   and "failed to load, here's a retry button" — audit `OverviewPage.tsx` as the
   reference implementation since it's the most complex, then check 2–3 other pages
   (`CustomersPage.tsx`, `TasksPage.tsx`) match the same three-state contract.

**Acceptance criteria:**
- Throttling the network to "offline" in devtools while using the app shows the
  offline banner within a couple seconds, and any in-flight action shows a clear
  failure state rather than hanging indefinitely.
- Simulating a slow/flaky connection (devtools "Slow 3G" + intermittent offline
  toggling) causes `dashboardService` calls to retry and eventually succeed or fail
  visibly, never silently hang.
- No page shows a blank/frozen screen when a fetch fails — every fetch site has a
  visible failure state with a retry affordance.

**Explicitly deferred (write these down, don't build them now):** local write queue /
optimistic writes while offline, service-worker-based response caching for read-only
views, background sync on reconnect. Revisit only if item 2 above turns out to be
insufficient in real usage.

---

## 3. Verify RLS tenant isolation with an actual adversarial test

**Problem:** Multi-tenancy is enforced by Postgres RLS (`010_tenant_isolation.sql`
and friends), which is the right design — but it has never been verified from the
attacker's seat, only trusted by design.

**Fix:**
- Write a script or a set of `psql`/Supabase-CLI-driven test cases (can live under
  `supabase/` — check `supabase/README.md` for the existing local-dev workflow first)
  that: creates two tenants, authenticates as Tenant A, and attempts to read/update/
  delete rows that belong to Tenant B by ID across every RLS-protected table
  (customers, bookings, orders, tasks, leads, resources, templates, communications,
  follow_ups, activity).
- Every one of those attempts must return zero rows / a permission error — not "200
  OK with someone else's data."
- If any table fails this, that's a P0 fix, not a backlog item — stop and fix the
  policy immediately, don't continue down this list.

**Acceptance criteria:** A repeatable script (checked into the repo, documented in
`DATABASE.md`) that any future migration author can re-run before shipping a new
table, to prove tenant isolation holds.

---

## 4. Bundle size / first-load performance check

**Problem:** Unknown current cost. Recharts + react-router + the full Supabase JS
client is a moderately heavy stack for a dashboard-first app aimed at users possibly
on slower mobile connections (the demo data is a Philippine resort).

**Fix:**
- Run `npm run build` and inspect the emitted chunk sizes (Vite prints this; add
  `rollup-plugin-visualizer` only if you need the breakdown, not as a permanent dep).
- Identify the biggest contributors. Recharts is likely one — check whether route-based
  code-splitting (`React.lazy` per page, since `AppRoutes.tsx` already centralizes
  routing) would keep chart-heavy pages (Overview, Reports) out of the initial bundle
  for pages that don't need them (Tasks, Leads).
- Set a rough budget (e.g. initial JS under ~250KB gzipped) and report where you land
  relative to it — don't chase a number if the app is already comfortably under it.

**Acceptance criteria:** A short written note (can go in `ARCHITECTURE.md`) stating
current bundle size, what's in it, and whether/what was lazy-loaded as a result.

---

## 5. Manual UI/QA pass (keyboard + both themes)

**Problem:** Two real bugs were just found and fixed by inspection (a stray browser
focus-outline showing as a black border on charts/buttons, and a leftover progress-bar
line under KPI numbers) — both suggest the UI was built fast without a dedicated
QA pass, not that anything is fundamentally broken.

**Fix:** Click through every page in `src/routes/navigation.ts` twice:
1. Once with a mouse, checking both the light theme and (if the app defines a
   dark theme — check `index.css` and any theme toggle in Settings) dark theme.
2. Once keyboard-only (Tab/Shift+Tab/Enter/Escape through the whole page) to confirm
   the new `:focus-visible` ring from `index.css` renders sensibly everywhere,
   nothing is keyboard-unreachable, and modals trap focus correctly
   (`src/components/ui/Modal.tsx`).

Log anything found as its own small fix — don't batch unrelated visual fixes into one
giant PR.

**Acceptance criteria:** A short list of what was checked and what (if anything) was
found and fixed, not a promise that everything is perfect.

---

## Suggested execution order

1. Error boundary — do this first, it's cheap insurance for everything else on this list.
2. Offline/connectivity resilience — the user's stated priority.
3. RLS adversarial test — security, do it before more features get built on top of the
   current trust-but-don't-verify posture.
4. UI/QA pass — cheap, mostly manual, catches more of the same class of bug as the
   border/progress-bar issues already found.
5. Bundle/perf check — lowest urgency, do last unless real users report slowness.

Each numbered item above is meant to be pasted on its own as the working prompt for
whoever (or whatever) implements it, with this file's section 0 "ground rules" carried
along as shared context.
