# System Design

Authoritative database, calculation, reporting, and security design. The migrations in
`supabase/migrations/` implement this specification; `scripts/db-test.sql` verifies it.

---

## 1. Domain model

```
auth.users (Supabase Auth)
    │ 1
    │
    │ 1
public.profiles ──────────────┐
  id (PK = auth.users.id)     │ created_by
  full_name                   │
  role: owner|admin|salesman  │
                              ▼
public.partners                 public.sales_memos
  id (PK)                         id (PK)
  name                            sale_date
  is_active                       customer_name          (nullable)
  created_at                      customer_phone         (nullable)
  updated_at                      customer_phone_normalized (generated)
                                  created_by   ─────────► profiles.id (RESTRICT)
                                  created_by_name
                                  created_by_role
                                  grand_total
                                  created_at / updated_at
                                       │ 1
                                       ▼ N
                                public.sales_memo_items
                                  id (PK)
                                  memo_id ─────────────► sales_memos.id (CASCADE)
                                  position
                                  partner_id ──────────► partners.id (RESTRICT, nullable)
                                  item_name
                                  quantity
                                  unit_price
                                  line_total (generated)
                                  created_at

public.expenses
  id (PK)
  name
  amount
  expense_date
  created_by ─────────────────► profiles.id (RESTRICT)
  created_by_name
  created_by_role
  created_at
```

No product, inventory, customer, or payment tables exist by design.

---

## 2. Enums and types

```sql
create type public.user_role as enum ('owner', 'admin', 'salesman');
```

| Value | Meaning |
| --- | --- |
| `owner` | Full access: all sales, partners, reports, role administration, deletion |
| `admin` | Records sales, reads all sales/reports, edits own memos; cannot administer partners/team |
| `salesman` | Records sales, reads/edits own memos only; reports scope to own sales |

---

## 3. Tables

### 3.1 `public.profiles`

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | — | PK, FK → `auth.users(id)` `ON DELETE CASCADE` |
| `full_name` | `text` | no | — | trimmed length 1–120 |
| `role` | `public.user_role` | no | `'salesman'` | — |
| `created_at` | `timestamptz` | no | `now()` | — |
| `updated_at` | `timestamptz` | no | `now()` | touched by trigger |

Created exclusively by the `auth.users` insert trigger. Clients cannot insert or delete profiles.

### 3.2 `public.partners`

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `name` | `text` | no | — | trimmed length 1–120; unique on `lower(btrim(name))` |
| `is_active` | `boolean` | no | `true` | — |
| `created_at` | `timestamptz` | no | `now()` | — |
| `updated_at` | `timestamptz` | no | `now()` | touched by trigger |

Partners are never hard-deleted. The unique expression index prevents duplicate names,
including duplicates of deactivated partners; the UI lets the owner reactivate instead.

### 3.3 `public.sales_memos`

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `sale_date` | `date` | no | `current_date` | calendar date, no time component |
| `customer_name` | `text` | **yes** | `null` | if present, trimmed length 1–120 |
| `customer_phone` | `text` | **yes** | `null` | if present, trimmed length 1–40 and ≥ 5 digits |
| `customer_phone_normalized` | `text` | yes | generated | `nullif(regexp_replace(coalesce(customer_phone,''), '\D', '', 'g'), '')` stored |
| `created_by` | `uuid` | no | — | FK → `profiles(id)` `ON DELETE RESTRICT` |
| `created_by_name` | `text` | no | — | trimmed length 1–120; snapshot at creation |
| `created_by_role` | `public.user_role` | no | — | snapshot of the creator's role at creation |
| `grand_total` | `numeric(16,2)` | no | `0` | `>= 0`; maintained only by trigger |
| `created_at` | `timestamptz` | no | `now()` | — |
| `updated_at` | `timestamptz` | no | `now()` | touched by trigger and by item changes |

`customer_name` and `customer_phone` are independently nullable. Empty strings are normalized to
`NULL` by the server and by the RPCs, so "not provided" has exactly one representation.

### 3.4 `public.sales_memo_items`

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `memo_id` | `uuid` | no | — | FK → `sales_memos(id)` `ON DELETE CASCADE` |
| `position` | `integer` | no | `0` | 0–1000; assigned 1..N by the RPC to preserve entry order |
| `partner_id` | `uuid` | **yes** | `null` | FK → `partners(id)` `ON DELETE RESTRICT`; optional per item |
| `item_name` | `text` | no | — | trimmed length 1–120 |
| `quantity` | `integer` | no | `1` | `1 <= quantity <= 100000` |
| `unit_price` | `numeric(12,2)` | no | — | `0 <= unit_price <= 1000000` |
| `line_total` | `numeric(14,2)` | no | generated | `quantity * unit_price`, stored |
| `created_at` | `timestamptz` | no | `now()` | stable ordering key |

Line item names are free text ("Jacket", "Shirt", "Shoes"). There is no product reference.
Partner assignment lives on the item, so one sale can mix partners or leave some items unassigned.

### 3.5 `public.expenses`

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `name` | `text` | no | — | trimmed length 1–120 |
| `amount` | `numeric(14,2)` | no | — | `>= 0` |
| `expense_date` | `date` | no | `current_date` | set by the database; the modal has no date field |
| `created_by` | `uuid` | no | — | FK → `profiles(id)` `ON DELETE RESTRICT` |
| `created_by_name` | `text` | no | — | trimmed length 1–120; snapshot |
| `created_by_role` | `public.user_role` | no | — | snapshot |
| `created_at` | `timestamptz` | no | `now()` | — |

Expenses are an append-only ledger: no update or delete privilege/policy is granted. Every role can
add them from the sale editor; owners and admins also have the `/expenses` reporting tab.

---

## 4. Indexes

| Index | Purpose |
| --- | --- |
| `partners_name_unique` — `(lower(btrim(name)))` unique | Duplicate prevention, case-insensitive partner lookup |
| `sales_memos_sale_date_idx` — `(sale_date desc, created_at desc)` | History/report range scans and ordering |
| `sales_memos_created_by_idx` — `(created_by)` | Salesman scoping and FK checks |
| `sales_memos_customer_name_trgm_idx` — GIN `customer_name gin_trgm_ops` | Partial, case-insensitive name search |
| `sales_memos_customer_phone_trgm_idx` — GIN `customer_phone_normalized gin_trgm_ops` | Partial phone search |
| `sales_memo_items_memo_idx` — `(memo_id, position)` | Item loading in entry order |
| `sales_memo_items_partner_idx` — `(partner_id)` | Partner filters, breakdowns, and FK checks |
| `expenses_expense_date_idx` — `(expense_date desc, created_at desc)` | Daily/weekly/monthly expense reporting |
| `expenses_created_by_idx` — `(created_by)` | Salesman scoping and FK checks |

`pg_trgm` is enabled in the `extensions` schema.

---

## 5. Invariants and transactions

1. **Partner is optional and assigned per item.** A memo can mix partners or leave items
   unassigned. The create RPC rejects unknown or inactive partners; inactive partners remain valid
   when editing an existing sale so history stays editable.
2. **Every memo has at least one item.** Deferred constraint triggers on memo insert and item
   delete (`ensure_memo_has_items`) validate at commit time. The RPC may write the header before its
   items inside one transaction; a direct API caller that leaves a memo empty is rejected with
   `23514`.
3. **Line total is derived.** `line_total = quantity * unit_price`, stored generated column. No
   client write privilege.
4. **Item order is explicit.** `position` is assigned 1..N in the payload order by both RPCs;
   reads order by `position, id`. The database does not rely on transaction timestamps for order.
5. **Grand total is derived.** After any item insert, update, or delete:
   `grand_total = COALESCE(SUM(line_total), 0)` for that memo, computed by trigger
   `recalc_memo_total()` (`SECURITY DEFINER`, restricted `search_path`). No client write privilege
   on `grand_total`.
6. **Atomic writes.** `create_sales_memo` and `update_sales_memo` run as a single Postgres
   transaction: header + items all commit or all roll back. `update_sales_memo` replaces the item
   set (delete + insert) in the same transaction.
7. **History is immutable in identity.** `created_by`, `created_by_name`, `created_by_role`, and
   `created_at` cannot be updated by any client role (column privileges). Owners may edit sales data,
   but attribution stays.
8. **Partners cannot be deleted.** No `DELETE` privilege/policy; FK `RESTRICT` would block it anyway.
9. **Deleting a memo deletes its items** (`ON DELETE CASCADE`) in one statement.
10. **Timestamps are database clocks** (`now()`), never client supplied.
11. **Expenses are append-only.** The API role has only `SELECT` and column-limited `INSERT`;
    `expense_date` defaults to `current_date`, and no update/delete policy exists.
12. **Expense attribution is derived.** `created_by = auth.uid()` and the name/role snapshots must
    match the caller's profile under the insert policy.

---

## 6. RPC contracts

All functions are `SECURITY INVOKER` unless explicitly noted, set `search_path = public`, and are
callable only by `authenticated` (execute revoked from `PUBLIC`/`anon`).

### 6.1 `create_sales_memo(...) → uuid`

```sql
create_sales_memo(
  p_sale_date         date,
  p_customer_name     text,      -- nullable / empty → null
  p_customer_phone    text,      -- nullable / empty → null
  p_items             jsonb      -- [{item_name, partner_id?, quantity, unit_price}, ...]
) returns uuid
```

Server steps:

1. Reject if `auth.uid()` is null.
2. Load the caller's `full_name` and `role` from `profiles` (must exist); snapshot them into
   `created_by_name` and `created_by_role`.
3. Require 1–100 items; per item: trimmed name 1–120 chars, optional `partner_id` that must exist
   and be active, integer quantity 1–100000, numeric unit price 0–1 000 000 rounded half-up to 2
   decimals.
4. Validate optional customer fields and normalize empty → `NULL`; require ≥ 5 digits if a phone is
   supplied.
5. Insert the memo (`created_by = auth.uid()`, total defaults to 0), then items. Triggers compute
   `line_total` and `grand_total`.
6. Return the new memo id. Any error rolls back the header and every item.

RLS applies to the inserts. Error codes: `42501` for unauthorized or inactive item partners,
`22023` for an invalid payload (including an empty item list), and `23514` for the deferred
“memo must contain an item” constraint.

### 6.2 `update_sales_memo(...) → void`

```sql
update_sales_memo(
  p_memo_id uuid, p_sale_date date,
  p_customer_name text, p_customer_phone text, p_items jsonb
)
```

- Updates only rows visible to the caller under the memo `UPDATE` policy (owner, or creator).
  Zero updated rows raises `42501` — no information about whether the memo exists.
- Item partners must exist; inactive partners are allowed here so historical sales remain editable.
- Deletes the existing items and inserts the validated new set in the same transaction.
- Never changes `created_by`, `created_by_name`, `created_by_role`, `created_at`.

### 6.3 `list_sales_memos(...) → setof row`

```sql
list_sales_memos(
  p_from date = null, p_to date = null, p_query text = null,
  p_partner_id uuid = null, p_limit int = 20, p_offset int = 0
) returns table (
  id uuid, sale_date date,
  customer_name text, customer_phone text, created_by uuid,
  created_by_name text, created_by_role public.user_role,
  grand_total numeric, created_at timestamptz,
  updated_at timestamptz, items jsonb, total_count bigint
)
```

- `p_partner_id` matches memos having **at least one item** assigned to that partner.
- Inclusive date bounds; either may be `null` (all time). Default page size 20, capped at 100.
- `p_query` matches `customer_name ILIKE %query%` **or** normalized phone digits
  `LIKE %digits%`. `%`, `_`, and `\` in the query are escaped, so user input cannot act as a
  wildcard or a filter. Matching is case-insensitive.
- A memo with only a name, only a phone, or neither is returned by date filters; records with no
  customer data simply do not match non-empty customer search terms.
- `items` is a JSON array of line items ordered by `position, id`, preserving the order the
  salesman entered. Each entry includes `partner_id` and `partner_name` (both nullable).
- `total_count` is the full filtered count (`count(*) over ()`), used for pagination.
- Ordering: `sale_date DESC, created_at DESC`.
- Because the function is invoker-rights, RLS limits salesmen to their own memos for both rows and
  the count.

### 6.4 `sales_summary(p_from, p_to, p_partner_id default null)`

Returns one row: `grand_total numeric`, `memo_count bigint`, `item_count bigint` for inclusive
dates and the optional item partner. Totals and item counts come from line items; `memo_count` is
`count(distinct memo_id)` so a multi-partner memo is counted once.

### 6.5 `sales_by_partner(p_from, p_to, p_partner_id default null)`

Groups **item totals** by item partner. Returns nullable `partner_id`, `partner_name`
(`'No partner'` for the unassigned bucket), `memo_count` (distinct memos), and `grand_total`,
ordered by total descending then name. The unassigned row appears when no partner filter is applied.

### 6.6 `sales_by_day(p_from, p_to, p_partner_id default null)`

Returns one row per calendar day in the inclusive range (zero-filled via `generate_series`):
`day date`, `memo_count bigint` (distinct memos with matching items), `grand_total numeric`
(sum of matching item totals). Range length is validated by the app (≤ 366 days).

### 6.7 `set_user_role(p_user_id uuid, p_role user_role) → void`

`SECURITY DEFINER` (the only one that writes across users):

1. `is_owner()` must be true, else `42501`.
2. Target profile must exist.
3. Demoting an owner is rejected when only one owner remains (`42501`), so the workspace can never
   lock itself out.
4. Updates the role only. All other profile fields are untouched.

Every role change is therefore explicit, audited by the target's `updated_at`, and unavailable to
admins or salesmen even with a crafted request.

### 6.8 Expense writes

Expenses use a direct table insert from the server action (no RPC), with RLS as the authority:

- Zod validates a trimmed name (1–120 chars) and a price from 0 to 100,000,000, rounded to 2 decimals.
- The insert supplies `name`, `amount`, `created_by`, `created_by_name`, and `created_by_role`.
  `expense_date` is omitted, so the database default `current_date` applies.
- The insert policy requires `created_by = auth.uid()` and name/role snapshots matching the caller's
  profile. No update or delete privilege or policy exists.
- Error messages are mapped to safe user-facing text by the action.

---

## 7. Search normalization

### 7.1 Phone

```
input:  "+1 (555) 010-2030"
stored: customer_phone            = "+1 (555) 010-2030"
stored: customer_phone_normalized = "15550102030"
search: "555 0102" → digits "5550102" → matches
```

Rules:

- Normalized form = all Unicode-independent ASCII digits, in order (non-digits removed).
- At least 5 digits are required when a phone is provided; max 40 raw characters.
- Empty/whitespace phone → `NULL`.
- The raw value is preserved for display; matching always uses digits, so formatting differences
  never split results.

### 7.2 Name

- Case-insensitive substring match (`ILIKE`), supporting partial names ("ana" matches "Ana Souza").
- Trimmed; empty → `NULL`.
- Indexed with `pg_trgm` for `%term%` queries.

### 7.3 Query parsing

The search box accepts a single string. The SQL function simultaneously tries the name pattern and
the digit pattern; either may match. No separate “search by” selector is required.

---

## 8. Authorization: capability matrix

| Capability | Owner | Admin | Salesman |
| --- | :---: | :---: | :---: |
| Sign in | ✓ | ✓ | ✓ |
| Create sales memo (optional item partners) | ✓ | ✓ | ✓ |
| Sale entry screen (UI) | ✓ | ✓ | ✓ |
| Dashboard / all sales / history / reports | ✓ | ✓ | — |
| Edit own sale (UI) | ✓ | ✓ | — |
| Edit any sale | ✓ | — | — |
| Delete sale | ✓ | — | — |
| View partner options in the sale form | ✓ | ✓ | ✓ |
| Add expense (modal; all roles) | ✓ | ✓ | ✓ |
| Expense tab with daily/weekly/monthly totals | ✓ | ✓ | — |
| Create/edit/deactivate partners | ✓ | — | — |
| Change user roles | ✓ | — | — |

Enforcement points: navigation → page guard → Server Action guard → RLS. Salesmen are intentionally
limited to `/memos/new`; every other app route redirects there. RLS still permits salesmen to read
and write their own memo rows because the item-insert policy depends on memo visibility, so direct
API access never crosses user boundaries even though the UI exposes only the sale editor. The
matrix is verified by SQL tests using simulated JWTs.

---

## 9. Row Level Security policies

RLS is enabled on all application tables. Policies target `authenticated`; `anon` has no table
privileges.

Helper functions (`SECURITY DEFINER`, owner `postgres`, fixed `search_path`, execute granted to
`authenticated` only):

```sql
is_owner()            -- caller's role = 'owner'
is_admin_or_owner()   -- caller's role IN ('owner','admin')
current_user_role()   -- enum value or NULL
```

### 9.1 `profiles`

| Verb | Policy |
| --- | --- |
| SELECT | `id = auth.uid() OR is_owner()` |
| UPDATE | `id = auth.uid() OR is_owner()` (columns limited to `full_name`; roles only via `set_user_role`) |
| INSERT | none (trigger only) |
| DELETE | none |

A guard trigger rejects role changes from any API caller who is not an owner, as defense in
depth. Direct database connections without an end-user JWT (migrations and the owner bootstrap
script) are trusted operator context and may change roles.

### 9.2 `partners`

| Verb | Policy |
| --- | --- |
| SELECT | `true` for authenticated (names are needed to record sales) |
| INSERT | `is_owner()` |
| UPDATE | `is_owner()` |
| DELETE | none |

### 9.3 `sales_memos`

| Verb | Policy |
| --- | --- |
| SELECT | `is_admin_or_owner() OR created_by = auth.uid()` |
| INSERT | `created_by = auth.uid() AND created_by_name = (SELECT full_name FROM profiles WHERE id = auth.uid()) AND created_by_role = (SELECT role FROM profiles WHERE id = auth.uid())` |
| UPDATE | `is_owner() OR created_by = auth.uid()` |
| DELETE | `is_owner()` |

The insert check prevents attribution to someone else or a forged display name. Column privileges
prevent changing `created_by`, `created_by_name`, `created_at`, and `grand_total` afterwards.

### 9.4 `sales_memo_items`

| Verb | Policy |
| --- | --- |
| SELECT | memo is visible: `EXISTS (SELECT 1 FROM sales_memos m WHERE m.id = memo_id)` |
| INSERT / UPDATE / DELETE | memo is editable: `EXISTS (… AND (m.created_by = auth.uid() OR is_owner()))` |

The subquery is itself subject to `sales_memos` RLS, so item visibility always mirrors header
visibility.

### 9.5 `expenses`

| Verb | Policy |
| --- | --- |
| SELECT | `is_admin_or_owner() OR created_by = auth.uid()` |
| INSERT | `created_by = auth.uid() AND created_by_name = (SELECT full_name …) AND created_by_role = (SELECT role …)` |
| UPDATE | none |
| DELETE | none |

The expense ledger is append-only. Owners/admins see every expense; a salesman can see only their own
rows, though the UI gives them only the add-expense modal on the sale editor.

---

## 10. Privileges (defense in depth)

```sql
revoke all on profiles, partners, sales_memos, sales_memo_items, expenses from anon, authenticated;

grant select on profiles to authenticated;
grant update (full_name) on profiles to authenticated;

grant select on partners to authenticated;
grant insert (name) on partners to authenticated;
grant update (name, is_active) on partners to authenticated;

grant select on sales_memos to authenticated;
grant insert (sale_date, customer_name, customer_phone,
              created_by, created_by_name, created_by_role) on sales_memos to authenticated;
grant update (sale_date, customer_name, customer_phone) on sales_memos to authenticated;
grant delete on sales_memos to authenticated;          -- RLS: owner only

grant select on sales_memo_items to authenticated;
grant insert (memo_id, position, partner_id, item_name, quantity, unit_price)
  on sales_memo_items to authenticated;
grant update (partner_id, item_name, quantity, unit_price) on sales_memo_items to authenticated;
grant delete on sales_memo_items to authenticated;

grant select on expenses to authenticated;
grant insert (name, amount, created_by, created_by_name, created_by_role)
  on expenses to authenticated;               -- expense_date defaults to current_date
```

Even if RLS were misconfigured, `authenticated` cannot write `grand_total`, `line_total`,
`created_by`, `created_by_name`, `created_by_role`, `created_at`, or any `profiles.role`.

`line_total` is a generated column and rejects explicit writes at the database level. The
`grand_total` trigger is `SECURITY DEFINER` because the caller intentionally lacks that column
privilege.

---

## 11. Authentication lifecycle

1. **Register** (`/register`): `auth.signUp({ email, password, options: { data: { full_name } } })`.
2. **Profile trigger** on `auth.users` insert creates `profiles` with role `salesman`, a trimmed
   name, and metadata fallback (`email` local part, then `"New user"`).
3. **Sign in** (`/login`): password grant; `@supabase/ssr` stores HTTP-only session cookies.
4. **Session refresh**: `proxy.ts` calls `getUser()` and re-writes cookies when the access token is
   near expiry.
5. **Confirmation**: if enabled, the email link hits `/auth/callback?code=…`; the route exchanges the
   code and redirects to a relative `next` path only.
6. **Sign out**: Server Action calls `auth.signOut()` and redirects to `/login`.

No password or token is ever stored in application tables.

---

## 12. Owner bootstrap and operations

Self-signup never grants elevated roles. On a fresh environment:

```bash
# 1. Register the owner account through /register (it becomes 'salesman').
# 2. Promote it (operator-only, direct database access):
psql "$DATABASE_URL" -v email='owner@surf.example' -f scripts/promote-owner.sql

# 3. The owner signs in, opens /team, and assigns admin/salesman roles.
```

The promotion script matches the email case-insensitively against `auth.users` and updates exactly
one profile. It requires database credentials, which are never present in the web app.

`supabase/seed.sql` also provisions two **local-only** demo logins: `owner@gmail.com` (owner) and
`saleman@sale.com` (salesman). They are applied by `supabase db reset`, are not used by the app at
runtime, and must be removed or have their passwords rotated before production.

Production checklist: disable public signup or gate it behind invites after provisioning; keep
`SUPABASE_SERVICE_ROLE_KEY` out of the frontend entirely (this app does not use it); back up the
database; enable email confirmation; rotate keys if exposed.

---

## 13. Calculations

```
line_total = round(quantity × unit_price, 2)          -- generated column, exact numeric
grand_total = Σ line_total for the memo               -- trigger, exact numeric
```

- Quantities are integers 1–100 000. Unit prices are 0–1 000 000 with at most 2 decimals; the RPC
  rounds half-up to 2 decimals before insert.
- Formatting in the UI is display-only (`Intl.NumberFormat`), never submitted as truth.
- The client previews the same formulas in JavaScript for responsiveness; the server ignores the
  submitted `grand_total`/`line_total` fields entirely (and there are no such fields in the action
  contract).
- Mixed precision is avoided: money moves through Postgres `numeric`, not floating point.

---

## 14. Reporting semantics

| Concept | Definition |
| --- | --- |
| Day | `sale_date = day` (calendar date, inclusive) |
| Week | Monday 00:00 through Sunday 23:59, expressed as inclusive `sale_date` bounds |
| Month | First through last calendar day of the month |
| Custom | User-provided inclusive `from`/`to`; `from <= to`; span ≤ 366 days |
| Total sales | `SUM(line_total)` over matching line items |
| Number of sales memos | `COUNT(DISTINCT memo_id)` of matching memos |
| Partner breakdown | Item totals grouped by item partner; unassigned items appear as “No partner” |
| Daily trend | Zero-filled series for each day in range |
| Expense total | `SUM(amount)` over expenses whose `expense_date` falls in the period |
| Expense breakdown | Today, this week (Mon–Sun), and this month totals plus the matching entries |

Ranges are computed in UTC from the current date, matching `current_date` in Postgres. Sale and
expense dates carry no time or timezone. The UI shows the active range explicitly.

Reports are always RLS-scoped. Owners/admins see company data; salesmen are limited to their own
rows at the database layer and are not given dashboard/report pages in the UI.

---

## 15. Pagination and history

- Page size 20 (server cap 100), 1-indexed in URLs (`?page=2`).
- `total_count` from the window function drives the page count; the UI shows
  “Showing 21–40 of 137”.
- Filters (`from`, `to`, `q`, `partner`, `page`) are preserved by pagination links; the partner
  filter matches memos with at least one item assigned to that partner.
- History defaults to all time with no filters, so customer search is never silently narrowed by a
  hidden date range. The user can add dates explicitly.

---

## 16. Threat model and controls

| Threat | Control |
| --- | --- |
| Broken object-level authorization (IDOR) | Every read/write is RLS-filtered; invisible memo ids return 404 |
| Privilege escalation | Roles changed only through `set_user_role` (owner check); `profiles.role` not grantable; guard trigger; last-owner protection |
| Forged totals | Totals generated/trigger-maintained; client has no privilege; RPC ignores submitted totals |
| Forged attribution | Memo and expense `created_by`/name/role checks; immutable columns |
| Expense tampering | Append-only table: no update/delete privilege or policy; amount validated server-side |
| SQL/filter injection | No string-built PostgREST filters; parameterized RPC SQL; LIKE metacharacters escaped |
| Mass assignment | Zod allow-lists every field; column grants restrict writable columns |
| Service-key leakage | No service-role key exists in the app or environment |
| Cross-role data leakage via search/report | Search and aggregates are invoker-rights SQL, so RLS applies |
| Partner deletion breaking history | Item FK `ON DELETE RESTRICT`, no delete privilege/policy, deactivation instead |
| XSS | React escaping; no `dangerouslySetInnerHTML`; no user-supplied HTML |
| CSRF | Server Actions enforce same-origin requests and action IDs; session cookies are HTTP-only |
| Open redirect | Only relative `next` paths are followed after auth callbacks |
| Brute force | Supabase Auth rate limits; generic invalid-credentials message |

---

## 17. Test plan (executed in `scripts/db-test.sql` and Vitest)

**Database / RLS**

1. Profile auto-creation on signup with role `salesman`.
2. Salesman cannot read another user's memo or items; admin and owner can.
3. Salesman cannot insert a memo attributed to another user, a forged display name, or a forged role.
4. Salesman/admin cannot insert/update partners; owner can.
5. Salesman/admin cannot call `set_user_role`; owner can; last owner cannot be demoted.
6. `grand_total` rejects direct client update (column privilege).
7. Line/grand totals are exact after create, item update, and delete.
8. `create_sales_memo` rolls back everything if any item is invalid.
9. A memo committed without items (direct API path) is rejected by the deferred constraint trigger.
10. Admin cannot delete a memo; owner can (items cascade).
11. A memo with both customer fields null saves and appears in date history/reports.
12. Name-only and phone-only memos save; search finds each; phone matches formatted vs normalized.
13. Search does not exclude customer-less memos from unfiltered history.
14. Report totals/counts match expected values for day/week/month/custom ranges and partner filters.
15. Salesman report aggregates include only their own memos.
16. Creator name and role snapshots survive profile renames/role changes.
17. Item partners are optional; unassigned items are saved, filtered, and reported under “No partner”.
18. Inactive item partners are rejected for new sales but allowed when editing an existing sale.
19. A salesman can insert an expense; `expense_date` defaults to today and attribution is snapshotted.
20. Expense reads are scoped: a salesman sees only their own; admin and owner see all.
21. Forged expense attribution (other user, wrong name, or wrong role) is rejected.
22. Expenses cannot be updated or deleted; anonymous access is denied.

**Unit (Vitest)**

23. Money rounding, line totals, grand totals, zero and large values.
24. Phone normalization and display.
25. Date parsing, week (Monday) and month boundaries, range validation.
26. Zod schemas: optional customer fields in all four combinations, item limits, invalid dates, and
    expense name/price validation.

---

## 18. Deliberate exclusions

- No product catalog or stock: item names are free text.
- No customer table: customer data is snapshot per memo.
- No soft deletion of memos: owner deletion is explicit and cascades items.
- Single currency: Pakistani Rupees (PKR), formatted as `Rs` in the UI. Amounts remain numeric in
  the database, so no FX conversion or currency table is needed.
- No audit log beyond creator/timestamps; attribution is immutable and reports are reproducible.
- No cached aggregates: totals are derived on demand from indexed, RLS-filtered rows.

---

## 19. Consistency review checklist

- [x] Every table has a primary key; every relationship has a foreign key and explicit delete
      behavior.
- [x] Optional customer fields are nullable end-to-end (schema, RPC, Zod, UI, search, reports).
- [x] Calculations exist once as database truth and once as a display preview with identical
      rounding.
- [x] Each role's capabilities match between UI navigation, page guards, actions, and RLS.
- [x] Partner history is protected against deletion; expenses are append-only.
- [x] Indexes cover every filter/sort used by history, search, reporting, and expenses.
- [x] Expense attribution and amounts are enforced at the database boundary.
- [x] No service-role credential, demo sales/expenses, or placeholder policy remains. The only seeded
      data is the two documented local demo accounts.
