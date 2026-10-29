-- Surf Daily Sales Memo — Row Level Security and column privileges.
-- Authorization is enforced here, independently of the UI and Server Actions.

alter table public.profiles enable row level security;
alter table public.partners enable row level security;
alter table public.sales_memos enable row level security;
alter table public.sales_memo_items enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_owner());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_owner())
  with check (id = (select auth.uid()) or public.is_owner());

-- No INSERT policy: profiles are created only by the auth trigger.
-- No DELETE policy: removing a user is an operator action.

-- ---------------------------------------------------------------------------
-- partners
-- ---------------------------------------------------------------------------
create policy partners_select on public.partners
  for select to authenticated
  using (true);

create policy partners_insert on public.partners
  for insert to authenticated
  with check (public.is_owner());

create policy partners_update on public.partners
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- No DELETE policy: partners are deactivated, never deleted.

-- ---------------------------------------------------------------------------
-- sales_memos
-- ---------------------------------------------------------------------------
create policy sales_memos_select on public.sales_memos
  for select to authenticated
  using (public.is_admin_or_owner() or created_by = (select auth.uid()));

create policy sales_memos_insert on public.sales_memos
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and created_by_name = (
      select p.full_name
      from public.profiles p
      where p.id = (select auth.uid())
    )
    and created_by_role = (
      select p.role
      from public.profiles p
      where p.id = (select auth.uid())
    )
  );

create policy sales_memos_update on public.sales_memos
  for update to authenticated
  using (public.is_owner() or created_by = (select auth.uid()))
  with check (public.is_owner() or created_by = (select auth.uid()));

create policy sales_memos_delete on public.sales_memos
  for delete to authenticated
  using (public.is_owner());

-- ---------------------------------------------------------------------------
-- sales_memo_items
-- ---------------------------------------------------------------------------
create policy sales_memo_items_select on public.sales_memo_items
  for select to authenticated
  using (
    exists (
      select 1 from public.sales_memos m
      where m.id = memo_id
    )
  );

create policy sales_memo_items_insert on public.sales_memo_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sales_memos m
      where m.id = memo_id
        and (m.created_by = (select auth.uid()) or public.is_owner())
    )
  );

create policy sales_memo_items_update on public.sales_memo_items
  for update to authenticated
  using (
    exists (
      select 1 from public.sales_memos m
      where m.id = memo_id
        and (m.created_by = (select auth.uid()) or public.is_owner())
    )
  )
  with check (
    exists (
      select 1 from public.sales_memos m
      where m.id = memo_id
        and (m.created_by = (select auth.uid()) or public.is_owner())
    )
  );

create policy sales_memo_items_delete on public.sales_memo_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.sales_memos m
      where m.id = memo_id
        and (m.created_by = (select auth.uid()) or public.is_owner())
    )
  );

-- ---------------------------------------------------------------------------
-- Table and column privileges (defense in depth)
-- ---------------------------------------------------------------------------
revoke all on table public.profiles, public.partners, public.sales_memos,
  public.sales_memo_items
  from anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select on public.partners to authenticated;
grant insert (name) on public.partners to authenticated;
grant update (name, is_active) on public.partners to authenticated;

grant select on public.sales_memos to authenticated;
grant insert (
  partner_id, sale_date, customer_name, customer_phone,
  created_by, created_by_name, created_by_role
) on public.sales_memos to authenticated;
grant update (
  partner_id, sale_date, customer_name, customer_phone
) on public.sales_memos to authenticated;
grant delete on public.sales_memos to authenticated;

grant select on public.sales_memo_items to authenticated;
grant insert (memo_id, position, item_name, quantity, unit_price) on public.sales_memo_items to authenticated;
grant update (item_name, quantity, unit_price) on public.sales_memo_items to authenticated;
grant delete on public.sales_memo_items to authenticated;

-- ---------------------------------------------------------------------------
-- Function execute privileges
-- ---------------------------------------------------------------------------
revoke execute on function
  public.current_user_role(),
  public.is_owner(),
  public.is_admin_or_owner(),
  public.escape_like(text),
  public.create_sales_memo(uuid, date, text, text, jsonb),
  public.update_sales_memo(uuid, uuid, date, text, text, jsonb),
  public.list_sales_memos(date, date, text, uuid, integer, integer),
  public.sales_summary(date, date, uuid),
  public.sales_by_partner(date, date, uuid),
  public.sales_by_day(date, date, uuid),
  public.set_user_role(uuid, public.user_role)
  from public, anon;

grant execute on function
  public.current_user_role(),
  public.is_owner(),
  public.is_admin_or_owner(),
  public.escape_like(text),
  public.create_sales_memo(uuid, date, text, text, jsonb),
  public.update_sales_memo(uuid, uuid, date, text, text, jsonb),
  public.list_sales_memos(date, date, text, uuid, integer, integer),
  public.sales_summary(date, date, uuid),
  public.sales_by_partner(date, date, uuid),
  public.sales_by_day(date, date, uuid),
  public.set_user_role(uuid, public.user_role)
  to authenticated;

-- Trigger functions are not callable as RPCs; keep their default (PUBLIC) execute
-- so trigger execution is never affected by grant changes.
