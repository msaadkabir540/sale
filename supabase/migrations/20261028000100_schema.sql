-- Surf Daily Sales Memo — core schema
-- Tables, constraints, indexes, generated columns, and integrity triggers.

create extension if not exists pg_trgm with schema extensions;

create type public.user_role as enum ('owner', 'admin', 'salesman');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'salesman',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_check
    check (char_length(btrim(full_name)) between 1 and 120)
);

comment on table public.profiles is
  'Application profile for each Supabase auth user. Role is the authorization source of truth.';

-- ---------------------------------------------------------------------------
-- partners
-- ---------------------------------------------------------------------------
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_name_check
    check (char_length(btrim(name)) between 1 and 120)
);

create unique index partners_name_unique
  on public.partners (lower(btrim(name)));

comment on table public.partners is
  'Sales partners. Deactivated rather than deleted so historical memos keep their partner.';

-- ---------------------------------------------------------------------------
-- sales_memos
-- ---------------------------------------------------------------------------
create table public.sales_memos (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete restrict,
  sale_date date not null default current_date,
  customer_name text,
  customer_phone text,
  customer_phone_normalized text generated always as (
    nullif(regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g'), '')
  ) stored,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_by_name text not null,
  created_by_role public.user_role not null,
  grand_total numeric(16, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_memos_customer_name_check
    check (customer_name is null or char_length(btrim(customer_name)) between 1 and 120),
  constraint sales_memos_customer_phone_check
    check (customer_phone is null or char_length(btrim(customer_phone)) between 1 and 40),
  constraint sales_memos_customer_phone_digits_check
    check (customer_phone is null or length(regexp_replace(customer_phone, '\D', '', 'g')) >= 5),
  constraint sales_memos_created_by_name_check
    check (char_length(btrim(created_by_name)) between 1 and 120),
  constraint sales_memos_grand_total_check
    check (grand_total >= 0)
);

comment on table public.sales_memos is
  'Daily sales memo header. Customer fields are optional snapshots; totals are derived from items.';

-- ---------------------------------------------------------------------------
-- sales_memo_items
-- ---------------------------------------------------------------------------
create table public.sales_memo_items (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references public.sales_memos (id) on delete cascade,
  position integer not null default 0,
  item_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null,
  line_total numeric(14, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  constraint sales_memo_items_position_check
    check (position between 0 and 1000),
  constraint sales_memo_items_name_check
    check (char_length(btrim(item_name)) between 1 and 120),
  constraint sales_memo_items_quantity_check
    check (quantity between 1 and 100000),
  constraint sales_memo_items_unit_price_check
    check (unit_price between 0 and 1000000)
);

comment on table public.sales_memo_items is
  'Free-text line items. line_total is database-generated and never accepted from clients.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index sales_memos_sale_date_idx
  on public.sales_memos (sale_date desc, created_at desc);

create index sales_memos_partner_idx
  on public.sales_memos (partner_id);

create index sales_memos_created_by_idx
  on public.sales_memos (created_by);

create index sales_memos_customer_name_trgm_idx
  on public.sales_memos using gin (customer_name extensions.gin_trgm_ops);

create index sales_memos_customer_phone_trgm_idx
  on public.sales_memos using gin (customer_phone_normalized extensions.gin_trgm_ops);

create index sales_memo_items_memo_idx
  on public.sales_memo_items (memo_id, position);

-- ---------------------------------------------------------------------------
-- Timestamp maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

create trigger sales_memos_set_updated_at
  before update on public.sales_memos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grand total invariant
-- ---------------------------------------------------------------------------
create or replace function public.recalc_memo_total()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_memo_id uuid;
begin
  v_memo_id := coalesce(new.memo_id, old.memo_id);

  update public.sales_memos
     set grand_total = coalesce(
       (select sum(i.line_total) from public.sales_memo_items i where i.memo_id = v_memo_id),
       0
     )
   where id = v_memo_id;

  return null;
end;
$$;

comment on function public.recalc_memo_total() is
  'Keeps sales_memos.grand_total equal to the sum of database-generated line totals.';

create trigger sales_memo_items_recalc_total
  after insert or update or delete on public.sales_memo_items
  for each row execute function public.recalc_memo_total();

-- A memo must never be committed without at least one line item. The check is
-- deferred so the create/update RPCs can write the header and items in one
-- transaction; a direct API caller cannot leave an empty memo behind.
create or replace function public.ensure_memo_has_items()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_memo_id uuid;
begin
  if tg_table_name = 'sales_memos' then
    v_memo_id := new.id;
  else
    v_memo_id := old.memo_id;
  end if;

  if exists (select 1 from public.sales_memos m where m.id = v_memo_id)
     and not exists (
       select 1 from public.sales_memo_items i where i.memo_id = v_memo_id
     ) then
    raise exception 'A sales memo must contain at least one line item.'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger sales_memos_require_items
  after insert on public.sales_memos
  deferrable initially deferred
  for each row execute function public.ensure_memo_has_items();

create constraint trigger sales_memo_items_require_remaining
  after delete on public.sales_memo_items
  deferrable initially deferred
  for each row execute function public.ensure_memo_has_items();

-- ---------------------------------------------------------------------------
-- Profile provisioning on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    'salesman'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
