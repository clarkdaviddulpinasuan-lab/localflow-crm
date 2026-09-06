# QA Checklist — Manual UI/Keyboard Pass

Two real bugs were previously found & fixed by inspection (branded focus ring for
Recharts / buttons, and a leftover progress-bar line under KPI numbers), which
prompted this standing checklist. This file records what to check and logs what
the code-level pass already found and fixed. It is a list of what was checked —
not a promise of perfection.

## Theme note

`src/index.css` defines **light-only** tokens. There is no dark theme and no theme
toggle (no `@media (prefers-color-scheme)` block, no `dark:` variant, no toggle in
Settings). The plan's "both themes" pass therefore collapses to the light theme.

## Navigation scope

Every entry under `src/routes/navigation.ts` (`buildNavGroups`), with business-type
label overrides in mind (Customers/Bookings/Orders can be renamed per business type):

1. Overview (`/`)
2. Customers (`/customers`)
3. Bookings (`/bookings`)
4. Resources (`/resources`)
5. Orders (`/orders`)
6. Tasks (`/tasks`)
7. Calendar (`/calendar`)
8. Leads (`/leads`)
9. Reports (`/reports`)
10. Automation (`/automation`)
11. Templates (`/templates`)
12. Team (`/team`)
13. Activity (`/activity`)
14. Notifications (`/notifications`)
15. My Profile (`/profile`)
16. Settings (`/settings`)

## Two passes

### Pass 1 — Mouse (light theme)

| Page | Loads | Filters/search work | Row actions work | Create/edit modals open & close | No stray focus outlines |
| --- | --- | --- | --- | --- | --- |
| Overview | ☐ | — | ☐ | n/a | ☐ |
| Customers | ☐ | ☐ | ☐ | ☐ | ☐ |
| Bookings | ☐ | ☐ | ☐ | ☐ | ☐ |
| Resources | ☐ | ☐ | ☐ | ☐ | ☐ |
| Orders | ☐ | ☐ | ☐ | ☐ | ☐ |
| Tasks | ☐ | ☐ | ☐ | ☐ | ☐ |
| Calendar | ☐ | — | ☐ | ☐ | ☐ |
| Leads | ☐ | ☐ | ☐ | ☐ | ☐ |
| Reports | ☐ | ☐ | ☐ | ☐ | ☐ |
| Automation | ☐ | ☐ | ☐ | n/a | ☐ |
| Templates | ☐ | ☐ | ☐ | ☐ | ☐ |
| Team | ☐ | ☐ | ☐ | ☐ | ☐ |
| Activity | ☐ | — | — | n/a | ☐ |
| Notifications | ☐ | — | ☐ | n/a | ☐ |
| My Profile | ☐ | — | — | n/a | ☐ |
| Settings | ☐ | — | ☐ | ☐ | ☐ |

### Pass 2 — Keyboard only (Tab / Shift+Tab / Enter / Escape / Space)

Repeat the grid above, plus these cross-cutting checks:

- ☐ Focus order follows a sensible reading order (sidebar → main → actions) on every page.
- ☐ Every interactive control is reachable: buttons, row actions, dropdown/combobox, menu, toggle switches, links, pagination.
- ☐ The branded `:focus-visible` ring (primary-400 in `index.css`) appears on the focused element — never the old browser black outline, never hidden.
- ☐ Checkboxes/toggles respond to Space; buttons respond to Enter/Space.
- ☐ **Modals and bottom sheets trap focus** (`src/components/ui/Modal.tsx`): Tab wraps between first and last focusable, Shift+Tab reverses, Escape closes, and focus returns to the trigger on close. Every modal consumer to verify: BookingForm, CustomerForm, Resources page form, Settings forms, Templates page form, profile avatar dialog.
- ☐ Command palette (Ctrl/Cmd+K) opens by keyboard and its Escape/close path works.
- ☐ No page leaves the app in a state where focus is lost to `<body>` after closing an overlay.

## Found & fixed during the code-level pass (this hardening round)

1. **Stray black focus outline on Recharts charts / buttons** — pre-existing,
   verified fixed: `:focus-visible` branded ring in `src/index.css`, plus
   `.recharts-surface` / `.recharts-wrapper` outline reset (already in tree).
2. **Leftover progress-bar line under KPI numbers** — pre-existing, verified
   absent from current `KpiCard` (only the intended top accent strip renders).
3. **Modal accessibility (found & fixed this round)** — `Modal.tsx` previously had
   no dialog semantics, no Escape handling, no focus trap, no focus restore, and
   unnamed close buttons. Fixed:
   - `role="dialog"`, `aria-modal="true"`, `aria-label={title}`, `aria-label="Close"` on both close buttons.
   - Focus moves to the dialog on open; Tab/Shift+Tab trap with wrap-around; Escape closes; focus restored to the trigger on close; `body` scroll locked while open.
   - Covered by tests in `src/components/ui.test.tsx` (14 tests).

## Team invites (multi-member feature)

Server-side logic is covered by `npm test` and `supabase/invites/team_invite.test.sql`
(run on a real DB — see `DATABASE.md`). Manual checks for the UI:

### Owner / Manager ("Invite Member" button)

- ☐ Team page shows **Invite Member** for owner and manager; hidden for staff.
- ☐ Invite modal shows role dropdown; **Owner is not offered to managers**.
- ☐ Creating an invite lists it under **Pending invitations** with role badge + expiry.
- ☐ **Copy link** copies `…/signup?invite=<token>`; button flips to "Copied".
- ☐ Creating an invite **emails the invitee** (Resend when configured; dry-run logs otherwise). On a failed send, the page shows a notice and the Copy-link affordance remains usable.
- ☐ **Resend** re-emails the link and briefly shows "Sent".
- ☐ Opening the link in a fresh/incognito browser shows "Join <business>" with the inviter's name.
- ☐ **Revoke** removes the pending invite; the link then fails at signup with the "invalid, expired, or already used" message.
- ☐ Duplicate pending invite for the same email is rejected (unique index).

### Invitee

- ☐ Signing up from an invite link lands in the shared business dashboard (not a new business) with the invited role.
- ☐ Signing up from `/signup` without a link still creates a fresh business.
- ☐ A mismatched email, expired link, or reused link shows the rejection message and no account is created.

### Account lifecycle (revoked access)

- ☐ Removing a member from Team then signing in as that member shows the **Access revoked** screen with a working **Sign out**.
- ☐ The **last owner cannot be removed or demoted** (server) — confirm a graceful error, not a crash.

## Multi-business membership, admin accounts & leave (018 feature)

Server-side logic is covered by `npm test` and `supabase/membership/multi_business.test.sql`
(run on a real DB — see `DATABASE.md`). Manual checks for the UI:

### Business switcher

- ☐ Two browser profiles: Profile A owns Business A; Business A invites Profile B's email with a role.
- ☐ Profile B signs in from the invite link → lands in **Business A** (active business switched).
- ☐ Sidebar shows a **business switcher** listing Business A and B (Profile B's own business).
- ☐ Switching to B reloads the profile/team/business to B's data; switching back to A restores A's team list.
- ☐ A non-member business is **never** offered or switchable (server rejects).

### Admin-created accounts

- ☐ Team page → **Add a Team Member** → **Create account** tab: creates an account; that email can **sign in immediately** with the given password and lands in this business with the chosen role.
- ☐ **No new business** is created for an admin-created account.
- ☐ A manager sees **Create account** but the Owner role is not offered; a staff member sees neither tab.
- ☐ Creating an account for a person who already has an account **attaches** them to this business instead of duplicating/erroring (unless already a member).

### Leave business

- ☐ A member (non-owner) on Business A can **Leave**; after leaving, they either move to their remaining business or reach the **Access revoked** screen (if they had no other business).
- ☐ The **sole owner** sees Leave disabled with an explanation; adding a second owner enables it.
- ☐ Leaving one of several businesses keeps the others and their data intact.

## Deferred log

- Dark theme: not defined in the app; revisit if a dark theme is ever added.
- Visual QA of charts at small widths and `prefers-reduced-motion` (chart tooltip
  animation) — verify during the human keyboard pass above.