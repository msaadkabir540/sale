-- Surf Daily Sales Memo — database test suite.
--
-- DESTRUCTIVE: clears application tables and test accounts. Run only against a
-- local/test Supabase database:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f scripts/db-test.sql
--
-- The script creates its own accounts and fixtures, exercises RLS by simulating
-- Supabase JWTs, then removes everything it created.

\set ON_ERROR_STOP on
\pset pager off

\echo '=== 0. harness ==='

create schema tests;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

create or replace function tests.assert(p_condition boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'FAILED: %', p_label using errcode = 'P0001';
  end if;
  raise notice 'ok - %', p_label;
end;
$$;

create or replace function tests.assert_raises(p_sql text, p_sqlstate text, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_sqlstate then
      raise exception 'FAILED: % (expected SQLSTATE %, got %: %)',
        p_label, p_sqlstate, sqlstate, sqlerrm using errcode = 'P0001';
    end if;
    raise notice 'ok - %', p_label;
    return;
  end;

  raise exception 'FAILED: % (expected SQLSTATE %, no error raised)',
    p_label, p_sqlstate using errcode = 'P0001';
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Reset. Delete memos first so their items cascade; deleting items on their own
-- would (correctly) trip the deferred "memo must have items" constraint.
begin;
delete from public.sales_memos;
delete from public.expenses;
delete from public.partners;
delete from public.profiles
 where id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444'
 );
delete from auth.users
 where id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444'
 );
commit;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'owner@surf.test', '', now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Olivia Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'admin@surf.test', '', now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Adam Admin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'sales1@surf.test', '', now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Sam Sales"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'sales2@surf.test', '', now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Sara Sales"}', now(), now(), '', '', '', '');

select tests.assert(
  (select count(*) from public.profiles) = 4,
  'signup trigger created four profiles'
);

select tests.assert(
  (select count(*) from public.profiles where role <> 'salesman') = 0,
  'new accounts default to salesman'
);

-- Owner bootstrap is an operator action (no JWT context).
update public.profiles set role = 'owner'
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'admin'
 where id = '22222222-2222-2222-2222-222222222222';

insert into public.partners (name)
values ('Sunset Surf Co'), ('Ocean Edge'), ('Old Harbor');

select
  (select id from public.partners where name = 'Sunset Surf Co') as partner_one,
  (select id from public.partners where name = 'Ocean Edge') as partner_two,
  (select id from public.partners where name = 'Old Harbor') as partner_three,
  (select id from public.partners where lower(btrim(name)) = 'sunset surf co') as partner_lookup
\gset

select tests.assert(:'partner_one'::uuid is not null, 'partner fixture created');
select tests.assert(:'partner_lookup'::uuid = :'partner_one'::uuid, 'partner lookup is case-insensitive');

\echo '=== 1. create memos through the RPC as each role ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert(auth.uid() = '11111111-1111-1111-1111-111111111111'::uuid, 'JWT context resolves');
select public.create_sales_memo(
  date '2026-10-01',
  'Ana Souza',
  '+1 (555) 010-2030',
  jsonb_build_array(
    jsonb_build_object(
      'item_name', 'Jacket', 'quantity', 2, 'unit_price', 25.50,
      'partner_id', :'partner_one'::uuid
    ),
    jsonb_build_object(
      'item_name', 'Shirt', 'quantity', 1, 'unit_price', 100.00,
      'partner_id', :'partner_one'::uuid
    )
  )
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;
select public.create_sales_memo(
  date '2026-10-02',
  null,
  '5550109999',
  jsonb_build_array(
    jsonb_build_object(
      'item_name', 'Cap', 'quantity', 3, 'unit_price', 10.00,
      'partner_id', :'partner_two'::uuid
    )
  )
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;
select public.create_sales_memo(
  date '2026-10-03',
  'Bob Stone',
  null,
  jsonb_build_array(
    jsonb_build_object(
      'item_name', 'Sticker', 'quantity', 1, 'unit_price', 5.99,
      'partner_id', :'partner_one'::uuid
    )
  )
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;
select public.create_sales_memo(
  date '2026-10-08',
  null,
  null,
  jsonb_build_array(
    jsonb_build_object(
      'item_name', 'Board', 'quantity', 1, 'unit_price', 75.00,
      'partner_id', :'partner_one'::uuid
    ),
    jsonb_build_object(
      'item_name', 'Wax', 'quantity', 1, 'unit_price', 10.00,
      'partner_id', null
    )
  )
);
commit;

select
  (select id from public.sales_memos where customer_phone_normalized = '15550102030') as memo_a,
  (select id from public.sales_memos where customer_phone_normalized = '5550109999') as memo_b,
  (select id from public.sales_memos where customer_name = 'Bob Stone') as memo_c,
  (select id from public.sales_memos
    where created_by = '44444444-4444-4444-4444-444444444444') as memo_d
\gset

select tests.assert((select count(*) from public.sales_memos) = 4, 'four memos created');
select tests.assert((select count(*) from public.sales_memo_items) = 6, 'six line items created');

\echo '=== 2. totals, calculations, optional fields ==='

select tests.assert(
  (select grand_total from public.sales_memos where id = :'memo_a'::uuid) = 151.00,
  'memo A grand total is 151.00'
);
select tests.assert(
  (select line_total from public.sales_memo_items
    where memo_id = :'memo_a'::uuid and item_name = 'Jacket') = 51.00,
  'line total = quantity x unit price'
);
select tests.assert(
  (select sum(line_total) from public.sales_memo_items where memo_id = :'memo_a'::uuid) = 151.00,
  'grand total equals sum of line totals'
);
select tests.assert(
  (select customer_phone_normalized from public.sales_memos where id = :'memo_a'::uuid) = '15550102030',
  'phone normalization stores digits only'
);
select tests.assert(
  (select created_by from public.sales_memos where id = :'memo_a'::uuid)
    = '11111111-1111-1111-1111-111111111111'::uuid,
  'memo records the authenticated creator'
);
select tests.assert(
  (select created_by_name from public.sales_memos where id = :'memo_a'::uuid) = 'Olivia Owner',
  'memo snapshots the creator name'
);
select tests.assert(
  (select created_by_role from public.sales_memos where id = :'memo_a'::uuid) = 'owner',
  'memo snapshots the creator role'
);
select tests.assert(
  (select created_by_role from public.sales_memos where id = :'memo_c'::uuid) = 'salesman',
  'salesman memo records the salesman role'
);
select tests.assert(
  (select customer_name is null and customer_phone is null
     from public.sales_memos where id = :'memo_d'::uuid),
  'both customer fields may be null'
);
select tests.assert(
  (select customer_name = 'Bob Stone' and customer_phone is null
     from public.sales_memos where id = :'memo_c'::uuid),
  'name-only memo is stored'
);
select tests.assert(
  (select customer_phone = '5550109999' and customer_name is null
     from public.sales_memos where id = :'memo_b'::uuid),
  'phone-only memo is stored'
);
select tests.assert(
  (select grand_total from public.sales_memos where id = :'memo_d'::uuid) = 85.00,
  'memo with an unassigned item totals 85.00'
);
select tests.assert(
  (select count(*) from public.sales_memo_items
    where memo_id = :'memo_d'::uuid and partner_id is null) = 1,
  'a line item may have no partner'
);
select tests.assert(
  (select count(*) from public.sales_memo_items
    where memo_id = :'memo_a'::uuid and partner_id = :'partner_one'::uuid) = 2,
  'line items retain their assigned partner'
);

\echo '=== 3. RLS reads ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert((select count(*) from public.sales_memos) = 1, 'salesman sees only own memo');
select tests.assert(
  (select count(*) from public.sales_memos where id = :'memo_a'::uuid) = 0,
  'salesman cannot id-probe another memo'
);
select tests.assert((select count(*) from public.sales_memo_items) = 1, 'salesman sees only own items');
select tests.assert(
  (select count(*) from public.sales_memo_items where memo_id = :'memo_a'::uuid) = 0,
  'salesman cannot see another memo items'
);
select tests.assert((select count(*) from public.partners) = 3, 'salesman can read partner list');
select tests.assert((select count(*) from public.profiles) = 1, 'salesman sees only own profile');
select tests.assert(
  (select total_count from public.list_sales_memos(null, null, null, null, 20, 0)) = 1,
  'history count is RLS-scoped for salesman'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, 'Ana', null, 20, 0)) = 0,
  'customer search cannot leak another memo'
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert((select count(*) from public.sales_memos) = 4, 'admin sees all memos');
select tests.assert((select count(*) from public.sales_memo_items) = 6, 'admin sees all items');
select tests.assert((select count(*) from public.profiles) = 1, 'admin does not enumerate profiles');
select tests.assert(
  (select grand_total from public.sales_summary(date '2026-10-01', date '2026-10-31')) = 271.99,
  'admin report sees company total'
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert((select count(*) from public.sales_memos) = 1, 'second salesman sees only own memo');
select tests.assert(
  (select grand_total from public.sales_summary(date '2026-10-01', date '2026-10-31')) = 85.00,
  'salesman report is scoped to own sales'
);
commit;

\echo '=== 3b. expenses ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.expenses (name, amount, created_by, created_by_name, created_by_role)
values ('Shopping bag', 1400.00, '33333333-3333-3333-3333-333333333333', 'Sam Sales', 'salesman');

select tests.assert((select count(*) from public.expenses) = 1, 'salesman sees own expense');
select tests.assert(
  (select amount from public.expenses where name = 'Shopping bag') = 1400.00,
  'expense amount is stored'
);
select tests.assert(
  (select expense_date from public.expenses where name = 'Shopping bag') = current_date,
  'expense defaults to today'
);
select tests.assert(
  (select created_by_name from public.expenses where name = 'Shopping bag') = 'Sam Sales',
  'expense snapshots the recorder name'
);

select tests.assert_raises(
  'update public.expenses set amount = 1',
  '42501',
  'expenses cannot be updated through the API'
);
select tests.assert_raises(
  'delete from public.expenses',
  '42501',
  'expenses cannot be deleted through the API'
);
select tests.assert_raises(
  $$insert into public.expenses (name, amount, created_by, created_by_name, created_by_role)
    values ('Forged', 10, '22222222-2222-2222-2222-222222222222', 'Adam Admin', 'admin')$$,
  '42501',
  'salesman cannot attribute an expense to another user'
);
select tests.assert_raises(
  $$insert into public.expenses (name, amount, created_by, created_by_name, created_by_role)
    values ('Forged', 10, '33333333-3333-3333-3333-333333333333', 'Fake Name', 'salesman')$$,
  '42501',
  'expense recorder name must match the profile'
);
select tests.assert_raises(
  $$insert into public.expenses (name, amount, created_by, created_by_name, created_by_role)
    values ('Forged', 10, '33333333-3333-3333-3333-333333333333', 'Sam Sales', 'owner')$$,
  '42501',
  'expense recorder role must match the profile'
);
select tests.assert((select count(*) from public.expenses) = 1, 'forged expenses were rejected');
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select tests.assert((select count(*) from public.expenses) = 0, 'second salesman cannot see the first expense');
insert into public.expenses (name, amount, created_by, created_by_name, created_by_role)
values ('Fuel', 500.00, '44444444-4444-4444-4444-444444444444', 'Sara Sales', 'salesman');
select tests.assert((select count(*) from public.expenses) = 1, 'second salesman sees own expense');
select tests.assert(
  (select count(*) from public.expenses where name = 'Shopping bag') = 0,
  'expense reads are scoped per salesman'
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert((select count(*) from public.expenses) = 2, 'admin sees all expenses');
select tests.assert((select sum(amount) from public.expenses) = 1900.00, 'admin sees expense total');
select tests.assert(
  (select count(*) from public.expenses where created_by_name = 'Sam Sales') = 1,
  'admin sees expense attribution'
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert((select count(*) from public.expenses) = 2, 'owner sees all expenses');
select tests.assert((select sum(amount) from public.expenses) = 1900.00, 'owner sees expense total');
commit;

\echo '=== 4. customer search, pagination, and report accuracy ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, 'ana', null, 20, 0)) = 1,
  'partial name search is case-insensitive'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, 'BOB', null, 20, 0)) = 1,
  'name search supports partial terms'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, '5550102', null, 20, 0)) = 1,
  'partial phone digits match'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, '+1 555 010 2030', null, 20, 0)) = 1,
  'formatted phone search normalizes before matching'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, '5550109', null, 20, 0)) = 1,
  'phone search matches a partial group of digits'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, '%', null, 20, 0)) = 0,
  'LIKE wildcards in search input are escaped'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, '_', null, 20, 0)) = 0,
  'LIKE underscore in search input is escaped'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, null, null, 20, 0)) = 4,
  'unfiltered history includes memos without customer details'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(
     date '2026-10-02', date '2026-10-03', null, null, 20, 0)) = 2,
  'inclusive date filter'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(
     null, null, null, :'partner_one'::uuid, 20, 0)) = 3,
  'partner filter'
);
select tests.assert(
  (select total_count from public.list_sales_memos(null, null, null, null, 2, 0) limit 1) = 4,
  'pagination total_count covers the whole filtered set'
);
select tests.assert(
  (select count(*) from public.list_sales_memos(null, null, null, null, 2, 2)) = 2,
  'pagination offset returns the second page'
);
select tests.assert(
  (select sale_date from public.list_sales_memos(null, null, null, null, 20, 0) limit 1)
    = date '2026-10-08',
  'history is ordered newest sale date first'
);
select tests.assert(
  (select jsonb_array_length(items) from public.list_sales_memos(
     null, null, 'ana', null, 20, 0)) = 2,
  'memo items are returned with the history row'
);
select tests.assert(
  (select items_ok from (
     select bool_and((item ->> 'line_total')::numeric
       = (item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric) as items_ok
     from public.list_sales_memos(null, null, 'ana', null, 20, 0),
          jsonb_array_elements(items) as item
   ) s),
  'returned line totals are consistent'
);
select tests.assert(
  (select items -> 0 ->> 'item_name'
     from public.list_sales_memos(null, null, 'ana', null, 20, 0)) = 'Jacket',
  'line items keep their entry order'
);
select tests.assert(
  (select items -> 0 ->> 'partner_name'
     from public.list_sales_memos(null, null, 'ana', null, 20, 0)) = 'Sunset Surf Co',
  'history items include their partner name'
);
select tests.assert(
  (select count(*)
     from public.list_sales_memos(null, null, null, null, 20, 0) l,
          jsonb_array_elements(l.items) item
    where item ->> 'partner_id' is null) = 1,
  'history includes an item with no partner'
);

select tests.assert(
  (select grand_total from public.sales_summary(date '2026-10-01', date '2026-10-31')) = 271.99,
  'month total is 271.99'
);
select tests.assert(
  (select memo_count from public.sales_summary(date '2026-10-01', date '2026-10-31')) = 4,
  'month memo count is 4'
);
select tests.assert(
  (select item_count from public.sales_summary(date '2026-10-01', date '2026-10-31')) = 6,
  'month item count is 6'
);
select tests.assert(
  (select count(*) from public.sales_by_partner(date '2026-10-01', date '2026-10-31')) = 3,
  'partner breakdown has three rows including no-partner'
);
select tests.assert(
  (select grand_total from public.sales_by_partner(
     date '2026-10-01', date '2026-10-31') where partner_id = :'partner_one'::uuid) = 231.99,
  'partner one total is 231.99'
);
select tests.assert(
  (select memo_count from public.sales_by_partner(
     date '2026-10-01', date '2026-10-31') where partner_id = :'partner_one'::uuid) = 3,
  'partner one memo count is 3'
);
select tests.assert(
  (select grand_total from public.sales_by_partner(
     date '2026-10-01', date '2026-10-31') where partner_id is null) = 10.00,
  'unassigned items are grouped under no partner'
);
select tests.assert(
  (select memo_count from public.sales_by_partner(
     date '2026-10-01', date '2026-10-31') where partner_id is null) = 1,
  'no-partner row counts its memo'
);
select tests.assert(
  (select count(*) from public.sales_by_day(date '2026-10-01', date '2026-10-31')) = 31,
  'daily series covers every day of the month'
);
select tests.assert(
  (select grand_total from public.sales_by_day(
     date '2026-10-01', date '2026-10-31') where day = date '2026-10-03') = 5.99,
  'daily breakdown matches the memo'
);
select tests.assert(
  (select grand_total from public.sales_by_day(
     date '2026-10-01', date '2026-10-31') where day = date '2026-10-04') = 0,
  'daily series zero-fills days without sales'
);
select tests.assert(
  (select grand_total from public.sales_summary(
     date '2026-10-05', date '2026-10-11')) = 85.00,
  'weekly range total'
);
select tests.assert(
  (select grand_total from public.sales_summary(
     date '2026-10-01', date '2026-10-31', :'partner_two'::uuid)) = 30.00,
  'partner-filtered report total'
);
select tests.assert(
  (select item_count from public.sales_summary(
     date '2026-10-01', date '2026-10-31', :'partner_one'::uuid)) = 4,
  'partner-filtered item count includes only assigned items'
);
select tests.assert(
  (select grand_total from public.sales_summary(
     date '2026-10-01', date '2026-10-31', :'partner_one'::uuid)) = 231.99,
  'partner-filtered total excludes unassigned items'
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert(
  (select grand_total from public.sales_summary(date '2026-10-01', date '2026-10-31')) = 5.99,
  'salesman month total is own sales'
);
select tests.assert(
  (select memo_count from public.sales_summary(date '2026-10-01', date '2026-10-31')) = 1,
  'salesman month memo count is own memos'
);
select tests.assert(
  (select grand_total from public.sales_by_partner(
     date '2026-10-01', date '2026-10-31') where partner_id = :'partner_one'::uuid) = 5.99,
  'salesman partner breakdown is own sales'
);
commit;

\echo '=== 5. forbidden writes and privilege boundaries ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

update public.sales_memos set customer_name = 'Hacked' where id = :'memo_a'::uuid;
select tests.assert(
  (select count(*) from public.sales_memos where id = :'memo_a'::uuid) = 0,
  'salesman update of another memo affects zero rows'
);

update public.sales_memos set customer_name = 'Bob Stone Jr' where id = :'memo_c'::uuid;
select tests.assert(
  (select customer_name from public.sales_memos where id = :'memo_c'::uuid) = 'Bob Stone Jr',
  'salesman can edit own memo'
);
update public.sales_memos set customer_name = 'Bob Stone' where id = :'memo_c'::uuid;

delete from public.sales_memos where id = :'memo_c'::uuid;
select tests.assert((select count(*) from public.sales_memos) = 1, 'salesman cannot delete own memo');

select tests.assert_raises(
  format('update public.sales_memos set grand_total = 999 where id = %L', :'memo_c'),
  '42501',
  'authenticated caller cannot write grand_total'
);
select tests.assert_raises(
  format('update public.sales_memos set created_by = %L where id = %L',
         '22222222-2222-2222-2222-222222222222', :'memo_c'),
  '42501',
  'authenticated caller cannot rewrite attribution'
);
select tests.assert_raises(
  format('update public.profiles set role = %L where id = %L',
         'owner', '33333333-3333-3333-3333-333333333333'),
  '42501',
  'salesman cannot self-promote'
);
select tests.assert_raises(
  $$insert into public.partners (name) values ('Salesman Partner')$$,
  '42501',
  'salesman cannot create partners'
);
select tests.assert_raises(
  format($$insert into public.sales_memos
             (sale_date, created_by, created_by_name, created_by_role)
           values (current_date, %L::uuid, %L, 'owner')$$,
         '11111111-1111-1111-1111-111111111111', 'Olivia Owner'),
  '42501',
  'salesman cannot attribute a memo to another user'
);
select tests.assert_raises(
  format($$insert into public.sales_memos
             (sale_date, created_by, created_by_name, created_by_role)
           values (current_date, %L::uuid, 'Fake Name', 'salesman')$$,
         '33333333-3333-3333-3333-333333333333'),
  '42501',
  'display name must match the profile'
);
select tests.assert_raises(
  format($$insert into public.sales_memos
             (sale_date, created_by, created_by_name, created_by_role)
           values (current_date, %L::uuid, 'Sam Sales', 'owner')$$,
         '33333333-3333-3333-3333-333333333333'),
  '42501',
  'creator role must match the profile'
);
select tests.assert_raises(
  format($$select public.update_sales_memo(
             %L::uuid, date '2026-10-01', 'Ana', null,
             '[{"item_name":"X","quantity":1,"unit_price":1}]'::jsonb)$$,
         :'memo_a'),
  '42501',
  'salesman cannot edit another memo through the RPC'
);
select tests.assert_raises(
  format($$select public.set_user_role(%L::uuid, 'owner')$$,
         '33333333-3333-3333-3333-333333333333'),
  '42501',
  'salesman cannot change roles'
);
select tests.assert_raises(
  $$select public.create_sales_memo(
      date '2026-10-20', 'Atomic Test', null,
      '[{"item_name":"A","quantity":1,"unit_price":10},
        {"item_name":"B","quantity":0,"unit_price":5}]'::jsonb)$$,
  '22023',
  'invalid quantity is rejected'
);
select tests.assert_raises(
  $$select public.create_sales_memo(
      date '2026-10-20', null, '1234',
      '[{"item_name":"A","quantity":1,"unit_price":10}]'::jsonb)$$,
  '22023',
  'phone with fewer than five digits is rejected'
);
select tests.assert_raises(
  $$select public.create_sales_memo(
      date '2026-10-20', null, null, '[]'::jsonb)$$,
  '22023',
  'memo without items is rejected'
);
select tests.assert_raises(
  format($$select public.create_sales_memo(
      current_date, null, null,
      jsonb_build_array(
        jsonb_build_object(
          'item_name', 'A', 'quantity', 1, 'unit_price', 10,
          'partner_id', %L::uuid
        )
      ))$$,
    '99999999-9999-9999-9999-999999999999'),
  '42501',
  'unknown partner is rejected'
);
select tests.assert(
  (select count(*) from public.sales_memos where customer_name = 'Atomic Test') = 0,
  'failed create did not leave a partial memo'
);
commit;

select tests.assert(
  (select customer_name from public.sales_memos where id = :'memo_a'::uuid) = 'Ana Souza',
  'forbidden update did not change another memo'
);
select tests.assert(
  (select customer_name from public.sales_memos where id = :'memo_c'::uuid) = 'Bob Stone',
  'salesman restored own memo'
);
select tests.assert((select count(*) from public.sales_memos) = 4, 'no partial memos were committed');

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;
update public.sales_memos set customer_name = 'Admin Edit' where id = :'memo_a'::uuid;
select tests.assert(
  (select customer_name from public.sales_memos where id = :'memo_a'::uuid) = 'Ana Souza',
  'admin cannot edit a memo they did not create'
);
select tests.assert_raises(
  format($$select public.update_sales_memo(
             %L::uuid, date '2026-10-01', 'Ana', null,
             '[{"item_name":"X","quantity":1,"unit_price":1}]'::jsonb)$$,
         :'memo_a'),
  '42501',
  'admin cannot edit another memo through the RPC'
);
delete from public.sales_memos where id = :'memo_b'::uuid;
select tests.assert((select count(*) from public.sales_memos) = 4, 'admin cannot delete a memo');
select tests.assert_raises(
  $$insert into public.partners (name) values ('Admin Partner')$$,
  '42501',
  'admin cannot create partners'
);
select tests.assert_raises(
  format($$select public.set_user_role(%L::uuid, 'owner')$$,
         '44444444-4444-4444-4444-444444444444'),
  '42501',
  'admin cannot change roles'
);
commit;

\echo '=== 6. item updates keep the grand total correct ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;
select public.update_sales_memo(
  :'memo_c'::uuid,
  date '2026-10-03',
  'Bob Stone',
  null,
  jsonb_build_array(
    jsonb_build_object(
      'item_name', 'Sticker', 'quantity', 2, 'unit_price', 5.99,
      'partner_id', :'partner_one'::uuid
    )
  )
);
select tests.assert(
  (select grand_total from public.sales_memos where id = :'memo_c'::uuid) = 11.98,
  'update recalculates the grand total'
);
select tests.assert(
  (select count(*) from public.sales_memo_items where memo_id = :'memo_c'::uuid) = 1,
  'update replaces the item set'
);
select tests.assert(
  (select created_by_name from public.sales_memos where id = :'memo_c'::uuid) = 'Sam Sales',
  'update preserves attribution'
);
update public.sales_memo_items set quantity = 1, unit_price = 5.99
 where memo_id = :'memo_c'::uuid;
select tests.assert(
  (select grand_total from public.sales_memos where id = :'memo_c'::uuid) = 5.99,
  'direct item edit also recalculates the total'
);
commit;

\echo '=== 7. roles, attribution history, and last-owner protection ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select tests.assert((select count(*) from public.profiles) = 4, 'owner can list the team');
update public.profiles set full_name = 'Olivia Renamed'
 where id = '11111111-1111-1111-1111-111111111111';
select tests.assert(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111')
    = 'Olivia Renamed',
  'owner can update their own profile'
);

select public.set_user_role('44444444-4444-4444-4444-444444444444', 'admin');
select tests.assert(
  (select role from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'admin',
  'owner can promote a salesman to admin'
);
select tests.assert(
  (select created_by_role from public.sales_memos where id = :'memo_d'::uuid) = 'salesman',
  'creator role snapshot survives a later promotion'
);

select tests.assert_raises(
  format($$select public.set_user_role(%L::uuid, 'admin')$$,
         '11111111-1111-1111-1111-111111111111'),
  '42501',
  'the last owner cannot be demoted'
);

select public.set_user_role('44444444-4444-4444-4444-444444444444', 'salesman');
select tests.assert(
  (select role from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'salesman',
  'owner can restore a role'
);
commit;

select tests.assert(
  (select created_by_name from public.sales_memos where id = :'memo_a'::uuid) = 'Olivia Owner',
  'creator name snapshot survives profile renames'
);

update public.profiles set full_name = 'Olivia Owner'
 where id = '11111111-1111-1111-1111-111111111111';

\echo '=== 8. partner administration and deactivation ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert((select count(*) from public.partners) = 3, 'owner can list partners');
select tests.assert_raises(
  format('delete from public.partners where id = %L', :'partner_three'),
  '42501',
  'partners cannot be deleted'
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;
select public.create_sales_memo(
  date '2025-05-05',
  null,
  null,
  jsonb_build_array(
    jsonb_build_object(
      'item_name', 'Leash', 'quantity', 1, 'unit_price', 10.00,
      'partner_id', :'partner_three'::uuid
    )
  )
);
commit;

select
  (select id from public.sales_memos
    where sale_date = date '2025-05-05') as memo_e
\gset

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
update public.partners set name = 'Ocean Edge Surf' where id = :'partner_two'::uuid;
select tests.assert(
  (select name from public.partners where id = :'partner_two'::uuid) = 'Ocean Edge Surf',
  'owner can rename a partner'
);
update public.partners set name = 'Ocean Edge' where id = :'partner_two'::uuid;

insert into public.partners (name) values ('Test Partner');
select tests.assert(
  (select count(*) from public.partners where name = 'Test Partner') = 1,
  'owner can create a partner'
);

update public.partners set is_active = false where id = :'partner_three'::uuid;
select tests.assert(
  (select not is_active from public.partners where id = :'partner_three'::uuid),
  'owner can deactivate a partner'
);
commit;

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;
select tests.assert_raises(
  format($$select public.create_sales_memo(
             current_date, null, null,
             jsonb_build_array(
               jsonb_build_object(
                 'item_name', 'A', 'quantity', 1, 'unit_price', 10,
                 'partner_id', %L::uuid
               )
             ))$$,
         :'partner_three'),
  '42501',
  'new sales cannot use an inactive partner'
);
select public.update_sales_memo(
  :'memo_e'::uuid,
  date '2025-05-05',
  null,
  null,
  jsonb_build_array(
    jsonb_build_object(
      'item_name', 'Leash', 'quantity', 2, 'unit_price', 10.00,
      'partner_id', :'partner_three'::uuid
    )
  )
);
select tests.assert(
  (select grand_total from public.sales_memos where id = :'memo_e'::uuid) = 20.00,
  'existing sale remains editable with an inactive item partner'
);
commit;

\echo '=== 9. deletion ==='

begin;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
delete from public.sales_memos where id = :'memo_e'::uuid;
commit;

select tests.assert(
  (select count(*) from public.sales_memos where id = :'memo_e'::uuid) = 0,
  'owner can delete a memo'
);
select tests.assert(
  (select count(*) from public.sales_memo_items where memo_id = :'memo_e'::uuid) = 0,
  'deleting a memo cascades to its items'
);
select tests.assert(
  (select count(*) from public.sales_memos) = 4,
  'deleting the extra memo leaves the four fixtures'
);

\echo '=== 10. database-level integrity constraints ==='

select set_config('tests.memo_c', :'memo_c', false);

do $$
declare
  v_memo uuid := current_setting('tests.memo_c')::uuid;
begin
  begin
    delete from public.sales_memo_items where memo_id = v_memo;
    execute 'set constraints all immediate';
    raise exception 'FAILED: deleting the last item of a memo was accepted';
  exception
    when check_violation then
      raise notice 'ok - deferred constraint rejects a memo without items';
  end;
end;
$$;

select tests.assert(
  (select count(*) from public.sales_memo_items where memo_id = :'memo_c'::uuid) = 1,
  'the rejected delete was rolled back'
);

do $$
declare
  v_user uuid := '33333333-3333-3333-3333-333333333333';
begin
  begin
    insert into public.sales_memos (
      sale_date, created_by, created_by_name, created_by_role
    )
    values (current_date, v_user, 'Sam Sales', 'salesman');
    execute 'set constraints all immediate';
    raise exception 'FAILED: a memo without items was accepted';
  exception
    when check_violation then
      raise notice 'ok - direct empty memo insert is rejected';
  end;
end;
$$;

select tests.assert(
  (select count(*) from public.sales_memos) = 4,
  'rejected empty memo did not persist'
);

\echo '=== 11. anonymous access ==='

begin;
set local role anon;
select tests.assert_raises(
  'select count(*) from public.sales_memos',
  '42501',
  'anon cannot read memos'
);
select tests.assert_raises(
  $$select public.create_sales_memo(current_date, null, null, '[]'::jsonb)$$,
  '42501',
  'anon cannot call write RPCs'
);
select tests.assert_raises(
  'select count(*) from public.expenses',
  '42501',
  'anon cannot read expenses'
);
select tests.assert_raises(
  $$insert into public.expenses (name, amount, created_by, created_by_name, created_by_role)
    values ('Anonymous', 1, '33333333-3333-3333-3333-333333333333', 'Sam Sales', 'salesman')$$,
  '42501',
  'anon cannot insert expenses'
);
commit;

\echo '=== 12. cleanup ==='

begin;
delete from public.sales_memos;
delete from public.expenses;
delete from public.partners;
delete from public.profiles
 where id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444'
 );
delete from auth.users
 where id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444'
 );
commit;

drop schema tests cascade;

\echo '=== ALL DATABASE TESTS PASSED ==='
