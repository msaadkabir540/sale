-- Surf Daily Sales Memo — helpers, RPCs, and report functions.
-- All data functions are SECURITY INVOKER so Row Level Security applies to the caller.

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'owner' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('owner', 'admin') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Role changes are only possible through set_user_role; this trigger blocks any
-- future direct update path from silently escalating privileges.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'A profile id cannot be changed.' using errcode = '42501';
  end if;

  -- Trusted operator context (no end-user JWT, e.g. migrations/promote-owner.sql)
  -- may change roles; any API request must be made by an owner.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_owner() then
    raise exception 'Only an owner can change a role.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- LIKE escaping (prevents user input from acting as a wildcard)
-- ---------------------------------------------------------------------------
create or replace function public.escape_like(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(p_value, '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- ---------------------------------------------------------------------------
-- Create a memo and its items atomically
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_memo(
  p_partner_id uuid,
  p_sale_date date,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_user_role public.user_role;
  v_memo_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_item jsonb;
  v_item_name text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_item_count integer;
  v_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to record a sale.' using errcode = '42501';
  end if;

  select p.full_name, p.role into v_user_name, v_user_role
  from public.profiles p
  where p.id = v_user_id;

  if v_user_name is null then
    raise exception 'Your profile is missing. Ask an owner to restore access.'
      using errcode = '42501';
  end if;

  if p_partner_id is null
     or not exists (
       select 1 from public.partners p
       where p.id = p_partner_id and p.is_active
     ) then
    raise exception 'Select an active partner.' using errcode = '42501';
  end if;

  if p_sale_date is null
     or p_sale_date < date '2000-01-01'
     or p_sale_date > date '2100-12-31' then
    raise exception 'Enter a valid sale date.' using errcode = '22023';
  end if;

  v_customer_name := nullif(btrim(coalesce(p_customer_name, '')), '');
  if v_customer_name is not null and char_length(v_customer_name) > 120 then
    raise exception 'Customer name must be 120 characters or fewer.' using errcode = '22023';
  end if;

  v_customer_phone := nullif(btrim(coalesce(p_customer_phone, '')), '');
  if v_customer_phone is not null then
    if char_length(v_customer_phone) > 40 then
      raise exception 'Customer phone must be 40 characters or fewer.' using errcode = '22023';
    end if;
    if length(regexp_replace(v_customer_phone, '\D', '', 'g')) < 5 then
      raise exception 'Enter a customer phone with at least 5 digits.' using errcode = '22023';
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Add at least one line item.' using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 then
    raise exception 'Add at least one line item.' using errcode = '22023';
  end if;
  if v_item_count > 100 then
    raise exception 'A memo can contain at most 100 line items.' using errcode = '22023';
  end if;

  insert into public.sales_memos (
    partner_id, sale_date, customer_name, customer_phone,
    created_by, created_by_name, created_by_role
  )
  values (
    p_partner_id, p_sale_date, v_customer_name, v_customer_phone,
    v_user_id, v_user_name, v_user_role
  )
  returning id into v_memo_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each line item must be an object.' using errcode = '22023';
    end if;

    v_item_name := nullif(btrim(coalesce(v_item ->> 'item_name', '')), '');
    if v_item_name is null or char_length(v_item_name) > 120 then
      raise exception 'Each item needs a name of 120 characters or fewer.'
        using errcode = '22023';
    end if;

    begin
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Item quantity must be a whole number.' using errcode = '22023';
    end;

    if v_quantity is null or v_quantity < 1 or v_quantity > 100000 then
      raise exception 'Item quantity must be between 1 and 100000.' using errcode = '22023';
    end if;

    begin
      v_unit_price := round((v_item ->> 'unit_price')::numeric, 2)::numeric(12, 2);
    exception when others then
      raise exception 'Item unit price must be a number.' using errcode = '22023';
    end;

    if v_unit_price is null or v_unit_price < 0 or v_unit_price > 1000000 then
      raise exception 'Item unit price must be between 0 and 1,000,000.'
        using errcode = '22023';
    end if;

    v_position := v_position + 1;

    insert into public.sales_memo_items (memo_id, position, item_name, quantity, unit_price)
    values (v_memo_id, v_position, v_item_name, v_quantity, v_unit_price);
  end loop;

  return v_memo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Update a memo and replace its items atomically
-- ---------------------------------------------------------------------------
create or replace function public.update_sales_memo(
  p_memo_id uuid,
  p_partner_id uuid,
  p_sale_date date,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_name text;
  v_customer_phone text;
  v_item jsonb;
  v_item_name text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_item_count integer;
  v_updated integer;
  v_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to edit a sale.' using errcode = '42501';
  end if;

  if p_memo_id is null
     or not exists (select 1 from public.partners p where p.id = p_partner_id) then
    raise exception 'Select a valid partner.' using errcode = '22023';
  end if;

  if p_sale_date is null
     or p_sale_date < date '2000-01-01'
     or p_sale_date > date '2100-12-31' then
    raise exception 'Enter a valid sale date.' using errcode = '22023';
  end if;

  v_customer_name := nullif(btrim(coalesce(p_customer_name, '')), '');
  if v_customer_name is not null and char_length(v_customer_name) > 120 then
    raise exception 'Customer name must be 120 characters or fewer.' using errcode = '22023';
  end if;

  v_customer_phone := nullif(btrim(coalesce(p_customer_phone, '')), '');
  if v_customer_phone is not null then
    if char_length(v_customer_phone) > 40 then
      raise exception 'Customer phone must be 40 characters or fewer.' using errcode = '22023';
    end if;
    if length(regexp_replace(v_customer_phone, '\D', '', 'g')) < 5 then
      raise exception 'Enter a customer phone with at least 5 digits.' using errcode = '22023';
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Add at least one line item.' using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 then
    raise exception 'Add at least one line item.' using errcode = '22023';
  end if;
  if v_item_count > 100 then
    raise exception 'A memo can contain at most 100 line items.' using errcode = '22023';
  end if;

  update public.sales_memos
     set partner_id = p_partner_id,
         sale_date = p_sale_date,
         customer_name = v_customer_name,
         customer_phone = v_customer_phone
   where id = p_memo_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'This memo does not exist or you cannot edit it.' using errcode = '42501';
  end if;

  delete from public.sales_memo_items where memo_id = p_memo_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each line item must be an object.' using errcode = '22023';
    end if;

    v_item_name := nullif(btrim(coalesce(v_item ->> 'item_name', '')), '');
    if v_item_name is null or char_length(v_item_name) > 120 then
      raise exception 'Each item needs a name of 120 characters or fewer.'
        using errcode = '22023';
    end if;

    begin
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Item quantity must be a whole number.' using errcode = '22023';
    end;

    if v_quantity is null or v_quantity < 1 or v_quantity > 100000 then
      raise exception 'Item quantity must be between 1 and 100000.' using errcode = '22023';
    end if;

    begin
      v_unit_price := round((v_item ->> 'unit_price')::numeric, 2)::numeric(12, 2);
    exception when others then
      raise exception 'Item unit price must be a number.' using errcode = '22023';
    end;

    if v_unit_price is null or v_unit_price < 0 or v_unit_price > 1000000 then
      raise exception 'Item unit price must be between 0 and 1,000,000.'
        using errcode = '22023';
    end if;

    v_position := v_position + 1;

    insert into public.sales_memo_items (memo_id, position, item_name, quantity, unit_price)
    values (p_memo_id, v_position, v_item_name, v_quantity, v_unit_price);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- History + customer search (parameterized; LIKE metacharacters escaped)
-- ---------------------------------------------------------------------------
create or replace function public.list_sales_memos(
  p_from date default null,
  p_to date default null,
  p_query text default null,
  p_partner_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  partner_id uuid,
  partner_name text,
  sale_date date,
  customer_name text,
  customer_phone text,
  created_by uuid,
  created_by_name text,
  created_by_role public.user_role,
  grand_total numeric,
  created_at timestamptz,
  updated_at timestamptz,
  items jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with search as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as term,
      nullif(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '') as digits
  ),
  filtered as (
    select
      m.*,
      p.name as partner_name,
      count(*) over () as total_count
    from public.sales_memos m
    join public.partners p on p.id = m.partner_id
    cross join search s
    where (p_from is null or m.sale_date >= p_from)
      and (p_to is null or m.sale_date <= p_to)
      and (p_partner_id is null or m.partner_id = p_partner_id)
      and (
        s.term is null
        or m.customer_name ilike '%' || public.escape_like(s.term) || '%'
        or (s.digits is not null and m.customer_phone_normalized like '%' || s.digits || '%')
      )
  )
  select
    f.id,
    f.partner_id,
    f.partner_name,
    f.sale_date,
    f.customer_name,
    f.customer_phone,
    f.created_by,
    f.created_by_name,
    f.created_by_role,
    f.grand_total,
    f.created_at,
    f.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'item_name', i.item_name,
            'quantity', i.quantity,
            'unit_price', i.unit_price,
            'line_total', i.line_total
          )
          order by i.position, i.id
        )
        from public.sales_memo_items i
        where i.memo_id = f.id
      ),
      '[]'::jsonb
    ) as items,
    f.total_count
  from filtered f
  order by f.sale_date desc, f.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create or replace function public.sales_summary(
  p_from date,
  p_to date,
  p_partner_id uuid default null
)
returns table (grand_total numeric, memo_count bigint, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce((
      select sum(m.grand_total)
      from public.sales_memos m
      where m.sale_date between p_from and p_to
        and (p_partner_id is null or m.partner_id = p_partner_id)
    ), 0)::numeric(16, 2) as grand_total,
    (
      select count(*)
      from public.sales_memos m
      where m.sale_date between p_from and p_to
        and (p_partner_id is null or m.partner_id = p_partner_id)
    ) as memo_count,
    (
      select count(*)
      from public.sales_memo_items i
      join public.sales_memos m on m.id = i.memo_id
      where m.sale_date between p_from and p_to
        and (p_partner_id is null or m.partner_id = p_partner_id)
    ) as item_count;
$$;

create or replace function public.sales_by_partner(
  p_from date,
  p_to date,
  p_partner_id uuid default null
)
returns table (partner_id uuid, partner_name text, memo_count bigint, grand_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.partner_id,
    p.name as partner_name,
    count(*)::bigint as memo_count,
    sum(m.grand_total)::numeric(16, 2) as grand_total
  from public.sales_memos m
  join public.partners p on p.id = m.partner_id
  where m.sale_date between p_from and p_to
    and (p_partner_id is null or m.partner_id = p_partner_id)
  group by m.partner_id, p.name
  order by sum(m.grand_total) desc, p.name asc;
$$;

create or replace function public.sales_by_day(
  p_from date,
  p_to date,
  p_partner_id uuid default null
)
returns table (day date, memo_count bigint, grand_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d::date as day,
    count(m.id)::bigint as memo_count,
    coalesce(sum(m.grand_total), 0)::numeric(16, 2) as grand_total
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  left join public.sales_memos m
    on m.sale_date = d::date
   and (p_partner_id is null or m.partner_id = p_partner_id)
  group by d
  order by d asc;
$$;

-- ---------------------------------------------------------------------------
-- Owner-only role management
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_role public.user_role;
begin
  if not public.is_owner() then
    raise exception 'Only an owner can change roles.' using errcode = '42501';
  end if;

  select p.role into v_current_role
  from public.profiles p
  where p.id = p_user_id;

  if v_current_role is null then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if v_current_role = 'owner' and p_role <> 'owner' then
    if (select count(*) from public.profiles where role = 'owner') <= 1 then
      raise exception 'The workspace must keep at least one owner.' using errcode = '42501';
    end if;
  end if;

  update public.profiles
     set role = p_role
   where id = p_user_id;
end;
$$;
