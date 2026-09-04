# Edge Functions

`send-message` handles queued `communications` rows: it sends the message
through the configured provider and records `delivered` / `failed` on the row.
`send-test-email` powers "Test send" in Templates (no persistence).

## How delivery works

1. `sendCommunication()` (client) inserts a `communications` row with
   `status = 'pending'`.
2. It invokes `send-message`, passing only the row id. Supabase forwards the
   signed-in user's JWT, so the function reads/writes under the caller's own
   Row Level Security scope.
3. The function loads the sender identity from `settings` (`message_from`),
   calls the provider, and updates the row: `provider`, `provider_message_id`,
   `delivered_at`, or `status = 'failed'` + `error`.

## Providers

- **Resend** — used when the `RESEND_API_KEY` secret is present.
- **Dry-run** — used otherwise (or when `Force dry run` is on): logs the would-be
  email to the function logs and marks the row `delivered` with a `dryrun-…` id.
  This keeps local/test sends deterministic with no external calls.

SMS is planned but not wired yet; an SMS channel currently marks the row failed
with "SMS sending is not configured yet."

## Local development

1. Install Docker Desktop and the Supabase CLI, then start the stack:
   ```
   supabase start
   ```
2. Apply the migrations (the CLI applies `supabase/migrations/**` on start).
3. Store the Resend key (optional — omitting it just uses dry-run):
   ```
   supabase secrets set RESEND_API_KEY=re_xxxx
   ```
4. Serve functions with hot reload:
   ```
   supabase functions serve --env-file /path/to/supabase/functions/.env
   ```
   Copy `.env.example` to `.env` and fill in the key first.

Deploying the functions to your hosted project is done later via
`supabase functions deploy` (with `supabase secrets set RESEND_API_KEY=…`
first) — out of scope while the app itself is not yet on the internet.