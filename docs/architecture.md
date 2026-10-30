# Application Architecture

## 1. System context

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React Server Components (HTML)  ·  small Client Components     │
│  Form submissions ──► Server Actions                             │
└───────────────▲───────────────────────────────┬─────────────────┘
                │ cookies (session JWT)         │
┌───────────────┴───────────────────────────────▼─────────────────┐
│                       Next.js 16 (Node runtime)                  │
│  proxy.ts ─ refresh session ─► (app)/layout.tsx ─ profile guard  │
│  Pages (RSC) ─ typed queries ─┐        Server Actions ─ Zod ─┐   │
│                               │                              │   │
└───────────────────────────────┼──────────────────────────────┼───┘
                                │ supabase-js (user JWT)       │
┌───────────────────────────────▼──────────────────────────────▼───┐
│                            Supabase                              │
│  PostgREST  ·  RPCs (SECURITY INVOKER)  ·  RLS  ·  Auth (GoTrue) │
│                     PostgreSQL 17                                │
└──────────────────────────────────────────────────────────────────┘
```

There is no separate API tier: Server Components and Server Actions are the API. Every database
call carries the signed-in user's JWT, and Postgres RLS is the last line of defense.

---

## 2. Layers and responsibilities

| Layer | Location | Responsibility | Must not |
| --- | --- | --- | --- |
| Proxy | `src/proxy.ts` | Refresh auth cookies; keep sessions alive | Make authorization decisions on its own |
| Auth boundary | `src/lib/auth.ts` | Resolve `User` + `Profile` once per request; `requireUser`, `requireOwner` | Return data to unauthenticated callers |
| Route guards | `(app)/layout.tsx`, pages | Redirect anonymous users, restrict owner-only pages, 404 on invisible records | Be the only authorization |
| Presentation | `src/app/**/page.tsx`, `src/components/*` | Render states, forms, filters, tables | Compute authoritative totals or trust input |
| Validation | `src/lib/validation.ts` | Parse `FormData`/JSON into typed values; produce field errors | Trust hidden fields such as totals |
| Actions | `**/actions.ts` | Authenticate, authorize, validate, call DB, revalidate, redirect | Call the DB with elevated credentials |
| Queries | `src/lib/*-queries.ts` | Typed reads, mapping DB rows to view models | Mutate data |
| Database | `supabase/migrations/*` | Constraints, generated columns, triggers, RPCs, RLS, grants | — |

---

## 3. Project structure

```
.
├── docs/                          # tech.md, architecture.md, system-design.md, components.md
├── scripts/
│   ├── promote-owner.sql          # one-time owner bootstrap (run by an operator)
│   ├── setup-env.mjs              # writes .env.local from `supabase status`
│   └── db-test.sql                # RLS/transaction/report test suite
├── supabase/
│   ├── config.toml
│   ├── seed.sql                    # local demo accounts (never use in production)
│   └── migrations/
│       ├── 20261028000100_schema.sql
│       ├── 20261028000200_functions.sql
│       └── 20261028000300_rls.sql
├── src/
│   ├── proxy.ts                   # Next 16 network boundary (session refresh)
│   ├── app/
│   │   ├── layout.tsx             # html/body, fonts, metadata
│   │   ├── globals.css            # Tailwind import + design tokens + primitives
│   │   ├── page.tsx               # / → /dashboard or /login
│   │   ├── not-found.tsx
│   │   ├── (auth)/
│   │   │   ├── layout.tsx         # centered, unauthenticated shell
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── actions.ts         # signIn, signUp, signOut
│   │   ├── auth/callback/route.ts # email-confirmation exchange
│   │   └── (app)/
│   │       ├── layout.tsx         # auth guard + app shell
│   │       ├── loading.tsx
│   │       ├── error.tsx
│   │       ├── dashboard/page.tsx
│   │       ├── memos/
│   │       │   ├── page.tsx            # history + customer search + pagination
│   │       │   ├── new/page.tsx
│   │       │   ├── [id]/page.tsx       # memo detail
│   │       │   ├── [id]/edit/page.tsx
│   │       │   └── actions.ts          # create / update / delete
│   │       ├── reports/page.tsx        # daily/weekly/monthly/custom
│   │       ├── expenses/
│   │       │   ├── page.tsx            # owner/admin expense totals + entries
│   │       │   └── actions.ts          # createExpense
│   │       ├── partners/
│   │       │   ├── page.tsx            # owner-only CRUD/deactivate
│   │       │   └── actions.ts
│   │       └── team/
│   │           ├── page.tsx            # owner-only role management
│   │           └── actions.ts
│   ├── components/
│   │   ├── ui/                     # reusable HTML primitives (the only place raw tags live)
│   │   │   ├── button.tsx          # Button, ButtonLink, buttonStyles
│   │   │   ├── icon-button.tsx     # accessible icon-only button
│   │   │   ├── field.tsx           # Field, Label, FieldErrors
│   │   │   ├── input.tsx           # Input
│   │   │   ├── select.tsx          # Select
│   │   │   ├── table.tsx           # Table, sections, rows, cells
│   │   │   ├── submit-button.tsx   # form submit with pending state
│   │   │   └── modal.tsx           # portal dialog with keyboard/scroll handling
│   │   ├── memo-form/
│   │   │   ├── index.tsx           # client: sale state + layout
│   │   │   ├── top-bar.tsx         # client: back, expense, sign out, fullscreen
│   │   │   ├── memo-details.tsx    # customer and date fields
│   │   │   ├── line-items-card.tsx # line-item rows and live totals
│   │   │   ├── saved-sale-dialog.tsx
│   │   │   └── types.ts            # form types and helpers
│   │   ├── app-shell.tsx          # sidebar/topbar, role-aware navigation (server)
│   │   ├── nav-links.tsx          # client: active-link highlighting
│   │   ├── auth-forms.tsx         # client: sign-in and registration forms
│   │   ├── memo-table.tsx         # history rows (server)
│   │   ├── expense-dialog.tsx     # client: expense modal + trigger
│   │   ├── delete-memo-button.tsx # client: confirm + pending/error state
│   │   ├── pagination.tsx         # links preserve filters
│   │   ├── brand.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── stat-card.tsx
│   │   ├── page-header.tsx
│   │   ├── alert.tsx
│   │   ├── empty-state.tsx
│   │   └── icons.tsx
│   ├── lib/
│   │   ├── supabase/server.ts     # cookie-bound SSR client (server-only)
│   │   ├── supabase/proxy.ts      # cookie refresh for proxy.ts
│   │   ├── env.ts                 # lazy env access with clear errors
│   │   ├── auth.ts                # getCurrentProfile / requireProfile / requireOwner
│   │   ├── permissions.ts         # role capability predicates
│   │   ├── validation.ts          # Zod schemas + FormData/search-param parsers
│   │   ├── action-state.ts        # Server Action state contracts
│   │   ├── errors.ts              # safe Postgres/PostgREST error messages
│   │   ├── cn.ts                  # class-name merge helper
│   │   ├── search-params.ts       # firstParam helper
│   │   ├── money.ts               # rounding, line/grand totals, formatting
│   │   ├── phone.ts               # normalizePhone, phoneDigitCount
│   │   ├── partners.ts            # summarize distinct item partner names
│   │   ├── dates.ts               # UTC date helpers + report periods
│   │   ├── memo-queries.ts        # list/search/detail reads
│   │   ├── partner-queries.ts
│   │   ├── report-queries.ts
│   │   ├── expense-queries.ts
│   │   └── team-queries.ts
│   └── types/database.ts          # hand-written Database type for supabase-js
├── .env.example
├── README.md
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.mts
```

Route groups keep unauthenticated and authenticated shells separate without polluting URLs.

---

## 4. Request flows

### 4.1 Read (RSC page)

```
GET /memos?q=555&page=2
  → proxy.ts: refresh session cookies
  → (app)/layout.tsx: getUser(); no user → 302 /login
                      profiles.select(...) → role-aware nav
  → memos/page.tsx: parse searchParams (Zod) → listSalesMemos()
  → PostgREST RPC list_sales_memos(p_from, p_to, p_query, p_partner_id, limit, offset)
     (partner filter matches memos containing an item assigned to that partner)
  → RLS filters sales_memos (owner/admin: all, salesman: own)
  → RSC renders table, pagination, empty/error state
```

### 4.2 Write (Server Action)

```
POST (create memo form)
  → action: getCurrentProfile() → reject anonymous
  → Zod: ISO date, ≤120-char name, phone, 1..100 items with optional partner UUID,
          quantity int 1..100000, unit price 0..1,000,000 (2 dp)
  → supabase.rpc('create_sales_memo', {...})   ← single transaction
  → PL/pgSQL re-validates, snapshots creator name/role, inserts header + items as the caller
  → RLS INSERT policies check created_by = auth.uid() and the derived name/role
  → trigger recomputes grand_total from generated line totals
  → revalidatePath('/memos'), revalidatePath('/reports'), revalidatePath('/dashboard')
  → return { status: 'success', savedMemoId, savedTotal }
  → the editor stays on /memos/new and shows one success modal
  → “Record another sale” reloads a clean editor; no detail-page redirect
  → the Sales page lists the saved sale
  → on failure: { status: 'error', message, fieldErrors } rendered by the form
```

### 4.3 Sign-in

```
POST /login (Server Action)
  → supabase.auth.signInWithPassword
  → cookies set by @supabase/ssr
  → redirect /dashboard
```

Email-confirmation links land on `/auth/callback?code=…&next=/dashboard`:

- exchange the code for a session
- only allow `next` values that start with `/` (no open redirect)
- redirect to `/login?error=…` if the exchange fails

### 4.4 Session refresh

`proxy.ts` uses `updateSession()` from `src/lib/supabase/proxy.ts`:

- reads/writes cookies on the request and response
- calls `auth.getUser()` so an expired access token is refreshed
- never blocks a request by itself; route guards decide access

---

## 5. Modules

| Module | Pages | Actions | Queries | Tables / RPCs |
| --- | --- | --- | --- | --- |
| Authentication | `/login`, `/register`, `/auth/callback` | `signIn`, `signUp`, `signOut` | — | `auth.users`, `profiles` (trigger-created) |
| Dashboard | `/dashboard` | — | `report-queries` | report RPCs (RLS-scoped) |
| Sales memo | `/memos/new`, `/memos/[id]`, `/memos/[id]/edit` | `createMemo`, `updateMemo`, `deleteMemo` | `getMemo`, partner list | `create_sales_memo`, `update_sales_memo`, `sales_memos`, `sales_memo_items` |
| History & search | `/memos` | — | `listSalesMemos` | `list_sales_memos` RPC |
| Reports | `/reports` | — | `getReport` | `sales_summary`, `sales_by_partner`, `sales_by_day` |
| Expenses | `/expenses` (owner/admin) | `createExpense` | `listExpenses` | `expenses` |
| Partners | `/partners` | `createPartner`, `renamePartner`, `setPartnerActive` | `listPartners` | `partners` |
| Team | `/team` | `changeRole` | `listProfiles` | `set_user_role` RPC, `profiles` |

---

## 6. Role model

Detailed capability matrix and RLS policies live in `docs/system-design.md` §8–§10. Summary:

- Every memo snapshots the creator's id, name, and role; those fields are immutable afterwards.
- **Owner** — full read/write, partner administration, role administration, deletion, all expense
  reporting.
- **Admin** — records sales, sees all sales/reports, edits own sales, and sees all expense reporting;
  no partner/team administration.
- All roles can add an expense from the sale editor's modal; owners and admins also have the
  Expenses reporting tab.
- **Salesman** — records sales from the dedicated sale editor and can add expenses there. The UI
  exposes no dashboard, history, reports, expenses tab, partner, team, or sale-detail screen; those
  routes redirect to `/memos/new`. RLS still scopes every query to the salesman's own rows.

Navigation hides unavailable modules, pages reject them server-side, and RLS enforces them in the
database. Every path is independently guarded.

---

## 7. Rendering, caching, and states

- All authenticated routes are dynamic: they read cookies and request-specific search params. No
  `use cache`, no `cacheComponents`, no static caching of sales data.
- Server Actions call `revalidatePath` for affected surfaces, then redirect with a `notice`
  query parameter that renders a success alert.
- Each authenticated route has a `loading.tsx` skeleton at the group level; forms show pending
  states via `useActionState`/`useFormStatus`; lists and reports have explicit empty states; query
  and action failures render retryable error alerts. Route-level errors use Next's `error.tsx`.
- Unknown or unauthorized memo ids return `notFound()` (404), not an authorization hint.

---

## 8. UI composition

- **Design tokens** in `globals.css` (`@theme`): single teal accent, neutral surfaces, one
  accent. Components use tokens, not arbitrary colors.
- **Primitives**: `.card`, `.btn`, `.input`, `.label`, `.badge`, `.table` classes defined once with
  `@apply`; page markup stays readable. Application code consumes the React primitives in
  `src/components/ui/` (`Field`, `Input`, `Select`, `Table`, `Button`, `Modal`, `IconButton`) rather
  than raw HTML controls.
- **Responsive shell**: sidebar on `md+`, sticky header with wrapped tabs on mobile. The main area
  uses the full available width. The sale editor (`/memos/new` and `/memos/[id]/edit`) intentionally
  hides the app chrome and becomes a focused full-page sheet with its own Back link and a browser
  fullscreen toggle. It starts with eight numbered rows, ignores untouched blank rows on save, and
  collapses each row into a stacked card on mobile. On desktop the editor fills the viewport and only
  the line-item rows scroll, keeping the total and Save bar visible; on mobile the Save bar is sticky
  while the rows scroll inside the items card.
- **Accessibility**: labeled inputs, `aria-live` for totals/errors, focus-visible rings, semantic
  tables, minimum 44px touch targets.

### 8.1 Component standards

The full rules and inventory live in [`docs/components.md`](./components.md). The short version:

- Reuse the primitive or feature component that already exists; do not copy markup into a page.
- Raw `<input>`, `<select>`, `<table>`, `<label>`, and `<button>` elements are only allowed inside
  `src/components/ui/`. Everything else imports the wrappers.
- `Field` owns labels, hints, and field errors; `Input` and `Select` own native controls; `Table`
  and its cell components own semantic table markup; `Modal` owns portal, Escape, backdrop, and
  body-scroll behavior.
- Application files under `src/` stay at or below 500 lines. Split by responsibility when a
  component approaches that budget. `MemoForm`, for example, is split into state/layout, top bar,
  details, line items, and the saved-sale dialog.
- Pages compose sections and queries; feature widgets and forms live in `src/components/<feature>/`.
  Server Components are the default, and `"use client"` is added only where state or browser APIs
  are required.

---

## 9. Error handling contract

| Situation | Behavior |
| --- | --- |
| Not signed in | Redirect `/login?next=…` |
| Signed in, forbidden page (partners/team) | Redirect `/dashboard` with an explanatory notice |
| Memo not found or not visible | `notFound()` |
| Invalid form input | Action returns `{ status: 'error', fieldErrors, message }`; form keeps entered values |
| DB constraint/RLS rejection | Mapped to a non-enumerating message; details logged server-side only |
| Missing env vars | Lazy, explicit error on first client creation |
| Unexpected render error | `(app)/error.tsx` with retry |

---

## 10. Testing strategy

1. **Unit tests (Vitest)** — money rounding and totals, phone normalization, date period math
   (week starting Monday, month boundaries), Zod schemas (optional customer fields, quantity/price
   limits), report range validation.
2. **Database tests (SQL)** — executed against the local Supabase Postgres with simulated JWTs:
   RLS visibility per role, partner/salesman/admin/owner restrictions, expense access and
   append-only behavior, atomicity of the create RPC,
   server-side rejection of bad quantities, trigger-maintained grand totals, optional customer
   fields, name/phone search (partial, normalized), and report accuracy.
3. **Build gates** — `eslint`, `tsc --noEmit`, `next build`.
4. **Manual smoke** — sign up → promote owner → create partner → create memo with 0/1/2 customer
   fields → verify detail/history/reports/search → add an expense from the salesman screen → verify
   the owner/admin expense tab totals → verify salesman isolation.

---

## 11. Extensibility notes

- Adding a field to a memo: migration → Database type → Zod schema → form → detail/report views.
- Adding a role: enum value + capability predicates + RLS policies + tests. No UI-only shortcut.
- Reporting stays in SQL, so new breakdowns do not require loading full history into Node.
- The service-role key is intentionally absent; any future admin job must be a separate, explicitly
  reviewed server process — never imported into the web app.
