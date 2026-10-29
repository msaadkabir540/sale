# Surf Daily Sales

A private daily sales memo app for a surf shop. Staff record sales against partners, add free-text
line items, optionally attach a customer name and phone, and let the database compute every total.
Owners review daily, weekly, monthly, and custom-range performance and can find any memo by customer
name or phone number.

Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, and Supabase
(PostgreSQL + Auth + Row Level Security).

## Features

- **Three roles, enforced in Postgres** — owner, admin, and salesman. The UI, Server Actions, and RLS
  all agree; a forged request cannot exceed its role.
- **Atomic sales memos** — a memo and all of its items are written in one transaction. A memo can
  never be committed without at least one item.
- **Partner per line item** — every item can be assigned to a partner or left unassigned, so one
  sale can mix partners. Reports group item totals by partner with a “No partner” bucket.
- **Full-width workspace** — pages use the full content area. The sale editor hides the navigation
  and becomes a focused, memo-style sheet with eight starter rows and a fullscreen button.
- **Authoritative totals** — `line_total` is a generated column, `grand_total` is trigger-maintained,
  and clients have no privilege to write either.
- **Optional customer details** — name, phone, both, or neither. Customer-less memos still appear in
  history and every report.
- **Expense ledger** — every role can add a quick expense (name + price) from the sale editor;
  owners and admins also get an Expenses tab with the entries and daily, weekly, and monthly totals.
- **Stay-on-page saving** — saving a sale keeps the editor open, shows one success modal, and never
  jumps to the sale detail page. The Sales tab lists the saved sale.
- **Scrollable line items** — only the item rows scroll on desktop, keeping the total and Save button
  visible; on mobile the action bar stays sticky while the rows scroll. The footer shows the live
  item count, total quantity, and grand total; the success modal and sale detail show the same two
  counts.
- **Customer search** — partial, case-insensitive name search and normalized phone-number search
  (e.g. `+1 (555) 010-2030` matches `5550102`), scoped by RLS.
- **Reports** — today, this week (Mon–Sun), this month, last month, or a custom range up to 366 days,
  with total sales, memo count, line-item count, average memo, partner breakdown, and a zero-filled
  daily series.
- **Partner administration** — owners create, rename, deactivate, and reactivate partners. Partners
  are never deleted, so historical memos always resolve.
- **Immutable attribution** — each memo snapshots the creator's id, name, and role.

## Quick start

Prerequisites: Node.js 22+, npm, Docker (for local Supabase), and the Supabase CLI.

```bash
npm install
supabase start                 # Postgres, Auth, REST, Studio
npm run env:local              # writes .env.local from `supabase status`
supabase db reset              # apply migrations + local demo accounts
npm run dev                    # http://localhost:3000
```

### Local demo accounts

`supabase/seed.sql` creates two local-only accounts:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@gmail.com` | `owner@1234` |
| Salesman | `saleman@sale.com` | `sale@123` |

These are for local development only. Remove the seed block or rotate the passwords before any
production use. You can also register your own account; new accounts are salesmen by default and
can be promoted with direct database access (never exposed to the browser):

```bash
# Local default; use your hosted Postgres connection string in production.
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql "$DATABASE_URL" -v email='owner@example.com' -f scripts/promote-owner.sql
```

Then sign in, open **Team**, and assign roles. See `docs/system-design.md` §12 for production notes.

## Roles

| Capability | Owner | Admin | Salesman |
| --- | :---: | :---: | :---: |
| Record sales | ✓ | ✓ | ✓ |
| Sale entry screen | ✓ | ✓ | ✓ (only screen) |
| Add expenses | ✓ | ✓ | ✓ (from sale editor) |
| Expense reports (daily/weekly/monthly) | ✓ | ✓ | — |
| Dashboard, all sales history/reports | ✓ | ✓ | — |
| Edit sales | any | own | — |
| Delete sales | ✓ | — | — |
| Manage partners | ✓ | — | — |
| Change roles | ✓ | — | — |

Salesmen are intentionally limited to the sale entry screen. Dashboard, history, reports, partners,
team, and sale-detail routes redirect to `/memos/new`; the database still scopes every query so no
salesman can read or write another user's data through the API.

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # serve the production build
npm run lint         # ESLint (Next 16 has no `next lint`)
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests
npm run env:local    # write .env.local from the running local Supabase stack
npm run db:reset     # reapply migrations locally
```

Database/RLS/transaction/report suite (destructive; local or disposable database only):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db-test.sql
```

The suite creates its own accounts and fixtures, simulates Supabase JWTs, and cleans up afterwards.

## Documentation

- [`docs/tech.md`](docs/tech.md) — versions, dependencies, technical decisions, configuration.
- [`docs/architecture.md`](docs/architecture.md) — modules, request flows, structure, UI approach.
- [`docs/components.md`](docs/components.md) — component reuse rules, primitive catalog, and file
  size budget.
- [`docs/system-design.md`](docs/system-design.md) — schema, indexes, RPCs, RLS policies, grants,
  calculations, reports, threat model, and test plan.

## Security notes

- There is **no service-role key** anywhere in the application. Every query uses the signed-in
  user's cookie-bound session, and RLS is the final authority.
- The browser never receives a Supabase client; all reads/writes go through Server Components and
  Server Actions.
- Totals, attribution, and role snapshots are database-owned; clients cannot write them.
- Deactivate public signup in production once the team is provisioned, or add an invite flow.

All amounts are shown in Pakistani Rupees (PKR, displayed as `Rs`) and dates are treated as calendar
dates in UTC. Adjust `CURRENCY` in
`src/lib/money.ts` if needed.
