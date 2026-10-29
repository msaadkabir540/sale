-- Local development accounts.
--
-- These credentials are intentionally simple and must not be used in production.
-- They are applied by `supabase db reset` (seed) and are safe to re-run; existing
-- accounts keep their current password and are only re-linked to their role.

do $$
declare
  v_owner uuid := '11111111-2222-4333-8444-555555555555';
  v_salesman uuid := '22222222-3333-4444-8555-666666666666';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_owner,
      'authenticated',
      'authenticated',
      'owner@gmail.com',
      extensions.crypt('owner@1234', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Owner"}'::jsonb,
      now(),
      now(),
      '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_salesman,
      'authenticated',
      'authenticated',
      'saleman@sale.com',
      extensions.crypt('sale@123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Salesman"}'::jsonb,
      now(),
      now(),
      '', '', '', ''
    )
  on conflict (id) do nothing;

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values
    (
      v_owner::text,
      v_owner,
      jsonb_build_object(
        'sub', v_owner::text,
        'email', 'owner@gmail.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(), now(), now()
    ),
    (
      v_salesman::text,
      v_salesman,
      jsonb_build_object(
        'sub', v_salesman::text,
        'email', 'saleman@sale.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(), now(), now()
    )
  on conflict (provider_id, provider) do nothing;

  insert into public.profiles (id, full_name, role)
  values
    (v_owner, 'Owner', 'owner'),
    (v_salesman, 'Salesman', 'salesman')
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role;
end;
$$;
