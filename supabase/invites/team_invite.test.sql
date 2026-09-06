-- ============================================================================
-- LocalFlow CRM — Team-invite adversarial + behavioral test
--
-- Proves the multi-member model works end to end at the database layer:
--   1. An invitee signs up with a valid token and lands IN the inviter's
--      business (no new business created), with the invited role.
--   2. Signups WITHOUT a token keep the migration-010 behavior (fresh business).
--   3. Invalid/expired/revoked/reused tokens all REJECT the signup.
--   4. Email mismatch on the invite rejects the signup.
--   5. RLS: only owners (and managers for non-owner roles) can create/revoke
--      invites; a manager cannot mint an owner invite.
--   6. A business must keep at least one owner (protect_last_owner trigger).
--
-- REQUIREMENTS
--   * Run as a superuser (postgres / supabase_admin).
--   * Migrations 001-017 applied.
--
-- USAGE
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/invites/team_invite.test.sql
--   PowerShell: .\supabase\invites\run-team-invite-test.ps1 -ConnectionString $env:DATABASE_URL
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Harness: an owner signs up normally (no token) and gets business A.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'owner@localflow.test', crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Owen","last_name":"Owner"}'::jsonb, now(), now()
);

do $$
declare
  v_biz_a uuid;
  v_count bigint;
begin
  select p.business_id into v_biz_a from public.profiles p where p.user_id = '00000000-0000-0000-0000-000000001001';
  if v_biz_a is null then
    raise exception 'Harness failed: owner has no business.';
  end if;
  perform set_config('lf.inv.biz_a', v_biz_a::text, true);

  select count(*) into v_count from public.businesses;
  perform set_config('lf.inv.count_base', v_count::text, true);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Owner invites 'peer@localflow.test' as manager; invitee signs up with the
--    token and must join business A — no new business created.
-- ---------------------------------------------------------------------------
do $$
declare
  v_invite_id uuid;
  v_token uuid;
  v_biz_a uuid;
begin
  v_biz_a := current_setting('lf.inv.biz_a', true)::uuid;

  insert into public.invitations (business_id, email, role, invited_by)
  values (v_biz_a, 'peer@localflow.test', 'manager', '00000000-0000-0000-0000-000000001001')
  returning id, token into v_invite_id, v_token;

  perform set_config('lf.inv.token', v_token::text, true);
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'peer@localflow.test', crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Pia","last_name":"Peer","invite_token":"' || (select token::text from public.invitations where email = 'peer@localflow.test') || '"}'::jsonb, now(), now()
);

do $$
declare
  v_biz_a uuid;
  v_businesses bigint;
  v_inv_status text;
  v_accepted uuid;
  v_notified bigint;
begin
  v_biz_a := current_setting('lf.inv.biz_a', true)::uuid;

  select business_id, role
  into v_biz_a, v_inv_status
  from public.profiles p
  where p.user_id = '00000000-0000-0000-0000-000000001002';

  if v_biz_a is null then
    raise exception 'PASS CHECK FAILED: invitee has NO profile.';
  end if;
  if v_biz_a <> current_setting('lf.inv.biz_a', true)::uuid then
    raise exception 'FAIL: invitee was attached to the wrong business.';
  end if;
  if v_inv_status <> 'manager' then
    raise exception 'FAIL: invitee role should be manager, got %.', v_inv_status;
  end if;

  select count(*) into v_businesses from public.businesses;
  if v_businesses <> current_setting('lf.inv.count_base', true)::bigint then
    raise exception 'FAIL: joining via invite created a NEW business (%).', v_businesses;
  end if;

  select status, accepted_user_id into v_inv_status, v_accepted
  from public.invitations where email = 'peer@localflow.test';
  if v_inv_status <> 'accepted' or v_accepted <> '00000000-0000-0000-0000-000000001002' then
    raise exception 'FAIL: invite was not consumed correctly (status=%, accepted_user_id=%).', v_inv_status, v_accepted;
  end if;

  select count(*) into v_notified
  from public.notifications
  where user_id = '00000000-0000-0000-0000-000000001001'
    and title = 'New team member on board';
  if v_notified = 0 then
    raise exception 'FAIL: inviter was not notified.';
  end if;

  raise notice 'PASS: invitee joined business % as manager; no new business; invite consumed; inviter notified.', v_biz_a;
end $$;

-- ---------------------------------------------------------------------------
-- 2. RLS: the new manager can invite staff but NOT another owner.
-- ---------------------------------------------------------------------------
set local role authenticated;

select set_config('request.jwt.claim.sub',  '00000000-0000-0000-0000-000000001002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aud',  'authenticated', true);
select set_config('request.jwt.claims',
  '{"iss":"supabase","sub":"00000000-0000-0000-0000-000000001002","aud":"authenticated","role":"authenticated","email":"peer@localflow.test"}',
  true);

do $$
declare
  v_stmt text;
  v_affected integer;
begin
  v_stmt := format(
    'insert into public.invitations (business_id, email, role, invited_by) values (%L, %L, %L, %L)',
    current_setting('lf.inv.biz_a', true)::uuid, 'new-staff@localflow.test', 'staff', '00000000-0000-0000-0000-000000001002'
  );
  execute v_stmt;
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'FAIL: manager could not invite a staff member.';
  end if;
  raise notice 'PASS: manager CAN invite staff (1 row).';
end $$;

do $$
declare
  v_stmt text;
  v_affected integer;
begin
  v_stmt := format(
    'insert into public.invitations (business_id, email, role, invited_by) values (%L, %L, %L, %L)',
    current_setting('lf.inv.biz_a', true)::uuid, 'rival-owner@localflow.test', 'owner', '00000000-0000-0000-0000-000000001002'
  );
  execute v_stmt;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then
    raise exception 'FAIL: manager minted an OWNER invite (escape).';
  end if;
  raise notice 'PASS: manager CANNOT invite an owner (0 rows).';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Negative signups: each must be rejected by the trigger.
-- ---------------------------------------------------------------------------
do $$
declare
  v_biz_a uuid;
  v_token uuid;
begin
  v_biz_a := current_setting('lf.inv.biz_a', true)::uuid;

  -- 3a. Mismatched email on an otherwise valid token.
  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      '00000000-0000-0000-0000-000000001004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'wrong@localflow.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email"}'::jsonb,
      jsonb_build_object('first_name', 'Wrong', 'last_name', 'Email', 'invite_token', current_setting('lf.inv.token', true)::uuid), now(), now()
    );
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then raise; end if;
    if position('invalid, expired, or already used' in sqlerrm) = 0 then
      raise exception 'Unexpected rejection for mismatched email: %', sqlerrm;
    end if;
    raise notice 'PASS: mismatched email rejected (%).', sqlerrm;
  end;

  -- 3b. Unrecognised (bogus) token.
  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      '00000000-0000-0000-0000-000000001005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'bogus@localflow.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email"}'::jsonb,
      jsonb_build_object('first_name', 'Bogus', 'last_name', 'Token', 'invite_token', gen_random_uuid()), now(), now()
    );
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then raise; end if;
    if position('invalid, expired, or already used' in sqlerrm) = 0 then
      raise exception 'Unexpected rejection for bogus token: %', sqlerrm;
    end if;
    raise notice 'PASS: bogus token rejected (%).', sqlerrm;
  end;

  -- 3c. Expired invite.
  insert into public.invitations (business_id, email, role, invited_by, expires_at)
  values (v_biz_a, 'expired@localflow.test', 'staff', '00000000-0000-0000-0000-000000001001', now() - interval '1 hour');

  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      '00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'expired@localflow.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email"}'::jsonb,
      jsonb_build_object('first_name', 'Expired', 'last_name', 'Token', 'invite_token',
        (select token from public.invitations where email = 'expired@localflow.test')), now(), now()
    );
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then raise; end if;
    if position('invalid, expired, or already used' in sqlerrm) = 0 then
      raise exception 'Unexpected rejection for expired invite: %', sqlerrm;
    end if;
    raise notice 'PASS: expired invite rejected (%).', sqlerrm;
  end;

  -- 3d. Revoked (deleted) invite.
  insert into public.invitations (business_id, email, role, invited_by)
  values (v_biz_a, 'revoked@localflow.test', 'staff', '00000000-0000-0000-0000-000000001001');

  delete from public.invitations where email = 'revoked@localflow.test';

  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      '00000000-0000-0000-0000-000000001007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'revoked@localflow.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email"}'::jsonb,
      jsonb_build_object('first_name', 'Revoked', 'last_name', 'Token', 'invite_token',
        (select token from public.invitations where email = 'revoked@localflow.test')), now(), now()
    );
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then raise; end if;
    if position('invalid, expired, or already used' in sqlerrm) = 0 then
      raise exception 'Unexpected rejection for revoked invite: %', sqlerrm;
    end if;
    raise notice 'PASS: revoked invite rejected (%).', sqlerrm;
  end;

  -- 3e. Already-used token (the step-1 invite).
  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      '00000000-0000-0000-0000-000000001008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'reused@localflow.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email"}'::jsonb,
      jsonb_build_object('first_name', 'Reused', 'last_name', 'Token', 'invite_token', current_setting('lf.inv.token', true)::uuid), now(), now()
    );
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then raise; end if;
    if position('invalid, expired, or already used' in sqlerrm) = 0 then
      raise exception 'Unexpected rejection for reused token: %', sqlerrm;
    end if;
    raise notice 'PASS: reused token rejected (%).', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Default signup (no token) still creates a fresh business.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'solo@localflow.test', crypt('password', gen_salt('bf')), now(),
  '{"provider":"email"}'::jsonb, '{"first_name":"Solo","last_name":"Trader"}'::jsonb, now(), now()
);

do $$
declare
  v_businesses bigint;
  v_owner_role text;
begin
  select count(*) into v_businesses from public.businesses;
  if v_businesses <> current_setting('lf.inv.count_base', true)::bigint + 1 then
    raise exception 'FAIL: default signup did not create a fresh business (count=%).', v_businesses;
  end if;

  select role into v_owner_role from public.profiles where user_id = '00000000-0000-0000-0000-000000001003';
  if v_owner_role <> 'owner' then
    raise exception 'FAIL: default signup is not the owner of their business.';
  end if;

  raise notice 'PASS: token-less signup keeps migration-010 behavior (fresh business, % businesses total).', v_businesses;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Last-owner guard: can't demote/remove the only owner. Adding a second
--    owner (signup via owner-role invite) unlocks it.
-- ---------------------------------------------------------------------------
do $$
declare
  v_affected integer;
begin
  begin
    update public.profiles set role = 'staff' where user_id = '00000000-0000-0000-0000-000000001001';
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then
      raise exception 'FAIL: last owner was demoted.';
    end if;
    if position('at least one owner' in sqlerrm) = 0 then
      raise exception 'Unexpected error in last-owner guard: %', sqlerrm;
    end if;
    raise notice 'PASS: sole owner cannot be demoted (%).', sqlerrm;
  end;

  begin
    delete from public.profiles where user_id = '00000000-0000-0000-0000-000000001001';
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then
      raise exception 'FAIL: last owner was deleted.';
    end if;
    if position('at least one owner' in sqlerrm) = 0 then
      raise exception 'Unexpected error in last-owner guard: %', sqlerrm;
    end if;
    raise notice 'PASS: sole owner cannot be removed (%).', sqlerrm;
  end;
end $$;

-- Second owner joins via an owner-role invite from the owner.
do $$
declare
  v_biz_a uuid;
  v_token uuid;
begin
  v_biz_a := current_setting('lf.inv.biz_a', true)::uuid;
  insert into public.invitations (business_id, email, role, invited_by)
  values (v_biz_a, 'coowner@localflow.test', 'owner', '00000000-0000-0000-0000-000000001001')
  returning token into v_token;
  perform set_config('lf.inv.token_owner', v_token::text, true);
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000001009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'coowner@localflow.test', crypt('password', gen_salt('bf')), now(),
  '{"provider":"email"}'::jsonb,
  jsonb_build_object('first_name', 'Coco', 'last_name', 'Owner', 'invite_token', current_setting('lf.inv.token_owner', true)::uuid), now(), now()
);

do $$
declare
  v_affected integer;
  v_new_role text;
begin
  select role into v_new_role from public.profiles where user_id = '00000000-0000-0000-0000-000000001009';
  if v_new_role <> 'owner' then
    raise exception 'FAIL: co-owner''s role should be owner, got %.', v_new_role;
  end if;

  -- With two owners, demoting the original owner is now allowed.
  begin
    update public.profiles set role = 'staff' where user_id = '00000000-0000-0000-0000-000000001001';
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
      raise exception 'FAIL: expected owner demotion to succeed once a second owner exists.';
    end if;
    raise notice 'PASS: with a second owner, demotion works (1 row).';
  exception when others then
    if position('at least one owner' in sqlerrm) > 0 then
      raise exception 'FAIL: demotion blocked even though a second owner exists: %', sqlerrm;
    end if;
    raise;
  end;
end $$;

raise notice '==============================================================';
raise notice 'PASS: team-invite flows verified end to end.';
raise notice '==============================================================';

rollback;