-- Promote an existing account to owner.
--
-- Usage (operator-only, direct database access):
--   psql "$DATABASE_URL" -v email='owner@example.com' -f scripts/promote-owner.sql
--
-- The account must already exist (register through /register first). This script
-- never creates users or passwords. It is safe to run more than once.

\set ON_ERROR_STOP on

select set_config('surf.promote_email', :'email', false);

do $$
declare
  v_email text := current_setting('surf.promote_email');
  v_count integer;
begin
  if v_email is null or btrim(v_email) = '' then
    raise exception 'Pass the owner email with -v email=...';
  end if;

  update public.profiles p
     set role = 'owner'
    from auth.users u
   where p.id = u.id
     and lower(u.email) = lower(btrim(v_email));

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No account found for %', v_email;
  end if;

  raise notice 'Promoted % account(s) to owner: %', v_count, v_email;
end;
$$;

select set_config('surf.promote_email', '', false);
