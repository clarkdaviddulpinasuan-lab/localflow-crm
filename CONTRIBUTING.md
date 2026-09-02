# Contributing

Thanks for contributing to LocalFlow CRM! This guide covers the local setup and the conventions to follow.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npm run dev       # http://localhost:5173
```

Run everything you need:

```bash
npm run build          # type-check + production build
npm test               # unit/component tests
npm run test:coverage  # coverage report
npm run lint           # oxlint
```

## Project conventions

### Data & storage
- **Never** talk to `localStorage` or Supabase directly from a page/component.
- All persistence goes through a **service** in `src/services/*`.
- Services read/write the demo store (`demoStore.ts`) when `VITE_DEMO_MODE=true`, and call Supabase otherwise. Keep this swap clean so no UI changes are needed to switch backends.

### Types
- Domain models live in `src/types/index.ts`. If you add a table, mirror the model there.
- `src/types/database.ts` is **schema documentation only** — do not force it into the Supabase client generic (that breaks `.insert()` type inference).

### Styling
- Use Tailwind utility classes and the design tokens defined in `src/index.css` (primary, success, warning, danger, info, surface).
- Prefer existing UI primitives in `src/components/ui/` (Button, Card, Modal, Badge, Field, DataTable, …) over ad-hoc markup.

### Accessibility
- Use semantic HTML and labels on form fields.
- Preserve keyboard focus rings and ARIA attributes.
- Respect `prefers-reduced-motion` (already applied globally).

### Testing
- Utilities and services should be pure and unit-testable — add tests under the same folder (`*.test.ts(x)`).
- Run `npm test` before pushing; keep the suite green.

### Lint
- `npm run lint` should pass. Two known fast-refresh warnings are acceptable (context/hook exports and `set-state-in-effect` in AuthContext) — don't chase them.

## Commit style

- Write concise, imperative commit messages (e.g. "Add calendar month/week/day views").
- Stage only intended files; never commit secrets (`.env` is gitignored).

## Branching & pull requests

- Create a feature branch, make focused changes, and open a PR with a short description of the change and how to verify it.
