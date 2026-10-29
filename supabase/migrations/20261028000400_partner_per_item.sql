-- Partner assignment moves from the memo header to individual line items.
-- Existing items inherit their memo's partner before the header column is removed.

alter table public.sales_memo_items
  add column partner_id uuid references public.partners (id) on delete restrict;

update public.sales_memo_items i
   set partner_id = m.partner_id
  from public.sales_memos m
 where i.memo_id = m.id
   and i.partner_id is null;

create index sales_memo_items_partner_idx
  on public.sales_memo_items (partner_id);

-- These functions depend on sales_memos.partner_id and/or return the old shape.
drop function if exists public.create_sales_memo(uuid, date, text, text, jsonb);
drop function if exists public.update_sales_memo(uuid, uuid, date, text, text, jsonb);
drop function if exists public.list_sales_memos(date, date, text, uuid, integer, integer);
drop function if exists public.sales_summary(date, date, uuid);
drop function if exists public.sales_by_partner(date, date, uuid);
drop function if exists public.sales_by_day(date, date, uuid);

drop index if exists public.sales_memos_partner_idx;

alter table public.sales_memos
  drop column partner_id;

comment on column public.sales_memo_items.partner_id is
  'Optional partner for this line item. Reports group item totals by partner.';

-- ---------------------------------------------------------------------------
-- Create a memo and its items atomically
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_memo(
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
  v_partner_id uuid;
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
    raise exception 'A sale can contain at most 100 line items.' using errcode = '22023';
  end if;

  insert into public.sales_memos (
    sale_date, customer_name, customer_phone, created_by, created_by_name, created_by_role
  )
  values (
    p_sale_date, v_customer_name, v_customer_phone, v_user_id, v_user_name, v_user_role
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

    v_partner_id := null;
    if nullif(btrim(coalesce(v_item ->> 'partner_id', '')), '') is not null then
      begin
        v_partner_id := (v_item ->> 'partner_id')::uuid;
      exception when others then
        raise exception 'Select a valid partner for each item.' using errcode = '22023';
      end;

      if not exists (
        select 1 from public.partners p
        where p.id = v_partner_id and p.is_active
      ) then
        raise exception 'Each assigned partner must be active.' using errcode = '42501';
      end if;
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

    insert into public.sales_memo_items (
      memo_id, position, partner_id, item_name, quantity, unit_price
    )
    values (
      v_memo_id, v_position, v_partner_id, v_item_name, v_quantity, v_unit_price
    );
  end loop;

  return v_memo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Update a memo and replace its items atomically
-- ---------------------------------------------------------------------------
create or replace function public.update_sales_memo(
  p_memo_id uuid,
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
  v_partner_id uuid;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_item_count integer;
  v_updated integer;
  v_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to edit a sale.' using errcode = '42501';
  end if;

  if p_memo_id is null then
    raise exception 'That sale could not be identified.' using errcode = '22023';
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
    raise exception 'A sale can contain at most 100 line items.' using errcode = '22023';
  end if;

  update public.sales_memos
     set sale_date = p_sale_date,
         customer_name = v_customer_name,
         customer_phone = v_customer_phone
   where id = p_memo_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'This sale does not exist or you cannot edit it.' using errcode = '42501';
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

    v_partner_id := null;
    if nullif(btrim(coalesce(v_item ->> 'partner_id', '')), '') is not null then
      begin
        v_partner_id := (v_item ->> 'partner_id')::uuid;
      exception when others then
        raise exception 'Select a valid partner for each item.' using errcode = '22023';
      end;

      -- Inactive partners remain valid here so historical sales can be edited.
      if not exists (select 1 from public.partners p where p.id = v_partner_id) then
        raise exception 'Select a valid partner for each item.' using errcode = '22023';
      end if;
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

    insert into public.sales_memo_items (
      memo_id, position, partner_id, item_name, quantity, unit_price
    )
    values (
      p_memo_id, v_position, v_partner_id, v_item_name, v_quantity, v_unit_price
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- History + customer search
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
      count(*) over () as total_count
    from public.sales_memos m
    cross join search s
    where (p_from is null or m.sale_date >= p_from)
      and (p_to is null or m.sale_date <= p_to)
      and (
        p_partner_id is null
        or exists (
          select 1
          from public.sales_memo_items pi
          where pi.memo_id = m.id
            and pi.partner_id = p_partner_id
        )
      )
      and (
        s.term is null
        or m.customer_name ilike '%' || public.escape_like(s.term) || '%'
        or (s.digits is not null and m.customer_phone_normalized like '%' || s.digits || '%')
      )
  )
  select
    f.id,
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
            'partner_id', i.partner_id,
            'partner_name', p.name,
            'item_name', i.item_name,
            'quantity', i.quantity,
            'unit_price', i.unit_price,
            'line_total', i.line_total
          )
          order by i.position, i.id
        )
        from public.sales_memo_items i
        left join public.partners p on p.id = i.partner_id
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
-- Reports (line-item partner aware)
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
    coalesce(sum(i.line_total), 0)::numeric(16, 2) as grand_total,
    count(distinct m.id) as memo_count,
    count(i.id) as item_count
  from public.sales_memo_items i
  join public.sales_memos m on m.id = i.memo_id
  where m.sale_date between p_from and p_to
    and (p_partner_id is null or i.partner_id = p_partner_id);
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
    i.partner_id,
    coalesce(p.name, 'No partner') as partner_name,
    count(distinct i.memo_id)::bigint as memo_count,
    sum(i.line_total)::numeric(16, 2) as grand_total
  from public.sales_memo_items i
  join public.sales_memos m on m.id = i.memo_id
  left join public.partners p on p.id = i.partner_id
  where m.sale_date between p_from and p_to
    and (p_partner_id is null or i.partner_id = p_partner_id)
  group by i.partner_id, p.name
  order by sum(i.line_total) desc, coalesce(p.name, 'No partner') asc;
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
  with totals as (
    select
      m.sale_date,
      count(distinct m.id) as memo_count,
      sum(i.line_total) as grand_total
    from public.sales_memo_items i
    join public.sales_memos m on m.id = i.memo_id
    where m.sale_date between p_from and p_to
      and (p_partner_id is null or i.partner_id = p_partner_id)
    group by m.sale_date
  )
  select
    d::date as day,
    coalesce(t.memo_count, 0)::bigint as memo_count,
    coalesce(t.grand_total, 0)::numeric(16, 2) as grand_total
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  left join totals t on t.sale_date = d::date
  order by d asc;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function
  public.create_sales_memo(date, text, text, jsonb),
  public.update_sales_memo(uuid, date, text, text, jsonb),
  public.list_sales_memos(date, date, text, uuid, integer, integer),
  public.sales_summary(date, date, uuid),
  public.sales_by_partner(date, date, uuid),
  public.sales_by_day(date, date, uuid)
  from public, anon;

grant execute on function
  public.create_sales_memo(date, text, text, jsonb),
  public.update_sales_memo(uuid, date, text, text, jsonb),
  public.list_sales_memos(date, date, text, uuid, integer, integer),
  public.sales_summary(date, date, uuid),
  public.sales_by_partner(date, date, uuid),
  public.sales_by_day(date, date, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Column privileges
-- ---------------------------------------------------------------------------
grant insert (
  sale_date, customer_name, customer_phone, created_by, created_by_name, created_by_role
) on public.sales_memos to authenticated;

grant update (sale_date, customer_name, customer_phone)
  on public.sales_memos to authenticated;

grant insert (memo_id, position, partner_id, item_name, quantity, unit_price)
  on public.sales_memo_items to authenticated;

grant update (partner_id, item_name, quantity, unit_price)
  on public.sales_memo_items to authenticated;
