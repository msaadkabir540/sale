# Technology Stack

Darwaesh Khata — technical baseline, dependency policy, and the decisions that shape the
implementation. This document is the source of truth for versions; `package.json` and the lockfile
must match it.

---

## 1. Stack at a glance

| Layer | Choice | Version | Why |
| --- | --- | --- | --- |
| Runtime | Node.js | 22 LTS or newer (developed on 26.x) | Next.js 16 requires Node ≥ 20.9 |
| Framework | Next.js (App Router) | 16.4.3 | Latest stable; React Server Components, Server Actions, async request APIs |
| UI runtime | React / React DOM | 19.3.0 | Ships with Next.js 16 |
| Language | TypeScript | 5.x, `strict: true` | Compile-time safety across server and client boundaries |
| Styling | Tailwind CSS | 4.3.3 | Utility-first CSS, zero runtime, Turbopack loader |
| Database | PostgreSQL | 17 (Supabase) | Relational integrity, generated columns, RLS, PL/pgSQL |
| Auth | Supabase Auth | `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0 | Cookie-based sessions, JWT identity available to RLS |
| Authorization | PostgreSQL RLS + server guards | — | Enforced at the data layer, not just the UI |
| Validation | Zod | 4.6.7 | One schema for form input and action payloads |
| Tests | Vitest | 5.0.5 | Fast unit tests for pure logic; SQL tests cover the database |
| Lint | ESLint 9 (flat config) + `eslint-config-next` | 9.x / 16.4.3 | Next.js 16 removed `next lint`; ESLint runs directly |
| Package manager | npm | 11.x | Lockfile committed |

No experimental Next.js flags are enabled. Cache Components (`cacheComponents`) and React Compiler
are intentionally **off**: the application is a private, per-user dashboard where every route reads
the session, so static/pre-rendered caching adds risk without benefit.

---

## 2. Key technical decisions

### 2.1 Server-first data flow, no browser database client

Every read is a React Server Component; every write is a Server Action. The browser never imports
`@supabase/supabase-js`, so no Supabase client is instantiated in client bundles and no query runs
with a client-held token outside the cookie-based session.

Consequences:

- The anon key is only used server-side when constructing the SSR client. It is public by design,
  but RLS is what protects data.
- **No service-role key exists in the project.** Nothing bypasses RLS. There is no
  `SUPABASE_SERVICE_ROLE_KEY` environment variable to leak.
- Session cookies are refreshed once per request in `proxy.ts` (Next 16's replacement for
  `middleware.ts`), then read by server components and actions.

### 2.2 Authorization in four independent layers

1. **Proxy** (`src/proxy.ts`) refreshes the auth cookies on every matched request.
2. **Layout guard** (`src/app/(app)/layout.tsx`) resolves the user profile and redirects anonymous
   visitors to `/login`.
3. **Server-side permission checks** in pages and actions (`requireOwner`, `canViewAllSales`, …)
   produce correct navigation, 404s, and friendly errors.
4. **PostgreSQL RLS** is the final authority for every statement, including RPCs. Even a forged
   request with a stolen user JWT cannot read or mutate rows the role may not access.

### 2.3 Atomic multi-table writes through Postgres functions

A memo is a header plus N line items and must never be partially written. `create_sales_memo`,
`update_sales_memo`, and `set_user_role` are `SECURITY INVOKER` PL/pgSQL functions called through
`supabase.rpc()`. Running as the caller means RLS still applies; running inside the function means
header and items commit or roll back together.

### 2.4 Authoritative totals in the database

- `sales_memo_items.line_total` is a **stored generated column**: `quantity * unit_price`.
- `sales_memos.grand_total` is maintained by an `AFTER INSERT/UPDATE/DELETE` trigger on items and is
  never accepted from client input. The `authenticated` role has no `UPDATE` privilege on that
  column.
- The UI recomputes totals for immediate feedback only; it is explicitly untrusted.

### 2.5 Optional customer data without a customer module

`customer_name` and `customer_phone` are independently nullable on `sales_memos`. Both are
free-text snapshots, not references. This keeps history correct, allows memos without customers,
and avoids a customer registration workflow.

### 2.6 Phone normalization and searchable text

`customer_phone_normalized` is a generated column containing digits only
(`regexp_replace(customer_phone, '\D', '', 'g')`). Writes keep the human-formatted phone; reads and
searches use the normalized form. Search input is normalized the same way in SQL, so
`+1 (555) 010-2030` and `5550102030` match the same memo.

Name and phone searches use `pg_trgm` GIN indexes and parameterized SQL inside an RPC (no
string-built PostgREST filters, no filter-injection surface).

### 2.7 Deactivation over deletion for partners

`sales_memo_items.partner_id` is nullable and `ON DELETE RESTRICT`, and no `DELETE` policy or
privilege is granted on `partners`. Owners deactivate instead. Historical sales therefore always
resolve to a partner name, and a single sale can mix partners or leave items unassigned.

### 2.8 Historical creator identity

`created_by_name` and `created_by_role` are copied from the creator's profile when the memo is
created. Later profile renames or role changes do not rewrite history, and reports remain
attributable even if an account is removed.

### 2.9 Small dependency surface

No date library (native `Date` + UTC math), no table/form/chart/state library, no component
library. Reusable primitives live in `src/components`; date, money, phone, and permission rules live
in `src/lib`.

---

## 3. Dependencies

### Runtime

| Package | Purpose |
| --- | --- |
| `next`, `react`, `react-dom` | Application framework and UI |
| `@supabase/ssr` | Cookie-based Supabase server clients |
| `@supabase/supabase-js` | Typed PostgREST/RPC client (server only) |
| `zod` | Input validation at the server boundary |
| `server-only` | Build-time guard on modules that must never reach the browser |

### Development

| Package | Purpose |
| --- | --- |
| `typescript`, `@types/*` | Types |
| `eslint`, `eslint-config-next` | Linting (flat config) |
| `tailwindcss`, `@tailwindcss/turbopack` | Styling pipeline |
| `vitest` | Unit tests for pure logic |
| Supabase CLI (global) | Local Postgres/Auth stack, migrations, SQL tests |

No `dotenv`: Next.js loads `.env.local` natively. No ORM: the schema is explicit SQL and the typed
client is generated by hand in `src/types/database.ts`.

---

## 4. Configuration

### Environment variables

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | server | yes | Project URL, e.g. `http://127.0.0.1:54321` locally |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server | yes | Anon/publishable key; safe to expose, RLS enforces access |

There is deliberately **no service-role key**.

`.env.local` is git-ignored. `.env.example` documents the two values, and `npm run env:local`
generates `.env.local` from the running local Supabase stack. Missing configuration fails fast with
a clear setup screen (HTTP 503) instead of a stack trace, and `next build` works without secrets.

### Supabase Auth settings

- Email + password sign-in. Email confirmation is optional; the app handles both the immediate
  session and the "check your email" flow (`/auth/callback`).
- New accounts receive the `salesman` role by trigger. An owner is provisioned once via SQL
  (`scripts/promote-owner.sql`), documented in `docs/system-design.md` §12.
- Public self-signup can be disabled in the Supabase dashboard once the team is provisioned.

---

## 5. Local development

```bash
npm install
supabase start                 # Postgres, Auth, REST, Studio (Docker required)
npm run env:local              # generates .env.local from `supabase status`
supabase db reset              # applies supabase/migrations/*
npm run dev                    # http://localhost:3000
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run build
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
  -v ON_ERROR_STOP=1 -f scripts/db-test.sql   # RLS, totals, search, reports
```

---

## 6. Compatibility and upgrade policy

- Core framework versions are pinned exactly; the lockfile is committed and CI must use `npm ci`.
- Next.js 16 conventions are used deliberately: `proxy.ts` (not `middleware.ts`), async
  `cookies()`/`headers()`/`params`/`searchParams`, `eslint` directly (no `next lint`), Turbopack.
- Postgres features used are all available on Supabase's Postgres 15+ (developed against 17):
  generated columns, RLS, `pg_trgm`, `security definer` helpers, `jsonb`.
- Upgrades must pass all quality gates and the SQL test suite before merging.

---

## 7. Non-goals

Product inventory, product catalog, payments, invoices, customer accounts, multi-tenant
organizations, offline mode, i18n, and background jobs are out of scope. The domain is intentionally
small: partners, memos, line items, roles, reports.
