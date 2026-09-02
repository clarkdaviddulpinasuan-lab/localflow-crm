# Deployment

LocalFlow CRM builds to a **static site** (`dist/`) and is deployed to **Vercel** with **Supabase** as the backend. It is a PWA, so visitors can install it to their phone/desktop home screen.

## 1. Supabase setup

1. Create a project at [app.supabase.com](https://app.supabase.com).
2. Open **SQL Editor** and run the migrations in order (`supabase/migrations/001_init.sql` → `010_tenant_isolation.sql`), or use the Supabase CLI: `supabase db push`.
   - `001` schema, enums, indexes, triggers, RLS
   - `002` backfill profiles for existing auth users
   - `003` backfill visit counts
   - `004` default `dashboard_config` settings row
   - `005` / `006` extra enum values
   - `007` follow-ups table
   - `008` message templates + communications tables
   - `009` link orders → bookings
   - `010` **each signup gets their own isolated business** (true multi-tenancy)
3. In **Project Settings → API**, copy the **Project URL** and **anon public key**.
4. Enable **Email** provider under Authentication → Providers (email/password sign-in).

Then set up the app and deploy. If your Supabase project predates migrations 007–010, paste `supabase/apply_latest.sql` into the SQL editor to bring it up to date (safe to re-run).

## 2. Configure the app

Create a `.env` locally (or set the variables in your host’s dashboard):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEMO_MODE=false
```

> `VITE_DEMO_MODE=true` runs entirely in the browser with no backend — great for demos and previews, but **every new account still needs the real database in production**.

## 3. Build locally

```bash
npm install
npm run build
```

Output goes to `dist/`. Type-checking runs as part of the build.

## 4. Deploy to Vercel

The repo includes `vercel.json` for SPA routing:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Via the dashboard
1. Push to GitHub, then Vercel → **Add New Project** → import your repo.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output `dist`.
3. Add environment variables from step 2 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_MODE=false`).
4. Deploy.

### Via CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

Deploys from `main` automatically.

## 5. Verify

- The home/auth routes load (SPA fallback works on deep links like `/customers`).
- Sign up a fresh account → it should be a brand-new, empty business (migration 010).
- Confirm data is isolated — a user from one business must never see another business’s rows (enforced by RLS).
- On a phone, open the deployed site → Add to Home Screen (PWA).

## Other hosts

Any static host works — Netlify (`netlify.toml` redirect), Cloudflare Pages (`_redirects`), GitHub Pages — just configure the corresponding SPA fallback.