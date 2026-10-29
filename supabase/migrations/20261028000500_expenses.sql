-- Daily expenses recorded by staff, with owner/admin reporting.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(14, 2) not null,
  expense_date date not null default current_date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_by_name text not null,
  created_by_role public.user_role not null,
  created_at timestamptz not null default now(),
  constraint expenses_name_check
    check (char_length(btrim(name)) between 1 and 120),
  constraint expenses_created_by_name_check
    check (char_length(btrim(created_by_name)) between 1 and 120),
  constraint expenses_amount_check
    check (amount >= 0)
);

comment on table public.expenses is
  'Simple daily expenses. Expense date defaults to the database current date.';

create index expenses_expense_date_idx
  on public.expenses (expense_date desc, created_at desc);

create index expenses_created_by_idx
  on public.expenses (created_by);

alter table public.expenses enable row level security;

create policy expenses_select on public.expenses
  for select to authenticated
  using (public.is_admin_or_owner() or created_by = (select auth.uid()));

create policy expenses_insert on public.expenses
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

-- No update or delete policies: expenses are an append-only ledger.

revoke all on table public.expenses from anon, authenticated;

grant select on public.expenses to authenticated;
grant insert (
  name, amount, created_by, created_by_name, created_by_role
) on public.expenses to authenticated;
