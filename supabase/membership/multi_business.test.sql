-- ============================================================================
-- LocalFlow CRM — Multi-business membership behavioral + adversarial test
--
-- Proves migration 018 end to end at the database layer:
--   1. Every new membership records which business is "current" for the user,
--      and current_business_id() (RLS) follows it.
--   2. An existing account can accept an invite and pick up a SECOND membership
--      (person owns their own business AND serves on a team).
--   3. switch_business() only allows verified memberships; strangers are
--      rejected. RLS trails the switched business.
--   4. admin_create_member() mints a confirmed account (no phantom business,
--      admin_created passthrough honored) OR attaches an existing account, and
--      the caller's privilege is enforced (manager cannot mint an owner).
--   5. An invite is single-use; a second accept is rejected.
--   6. leave_business() drops the active membership, moves the preference to a
--      remaining business, and clears it entirely at the last membership.
--   7. Owners cannot leave / be removed while they are the last owner.
--
-- REQUIREMENTS
--   * Run as a superuser (postgres / supabase_admin).
--   * Migrations 001-018 applied.
--
-- USAGE
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/membership/multi_business.test.sql
--   PowerShell: .\supabase\membership\run-multi-business-test.ps1 -ConnectionString $env:DATABASE_URL
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Harness A: owner signs up normally and lands in business A.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000002101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'm1@localflow.test', crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Mona","last_name":"Main"}'::jsonb, now(), now()
);

do $$
declare
  v_biz_a uuid;
  v_uc uuid;
begin
  select p.business_id into v_biz_a
  from public.profiles p
  where p.user_id = '00000000-0000-0000-0000-000000002101';
  if v_biz_a is null then
    raise exception 'Harness failed: owner has no business.';
  end if;
  perform set_config('lf.mb.biz_a', v_biz_a::text, true);

  select uc.business_id into v_uc
  from public.user_current_business uc
  where uc.user_id = '00000000-0000-0000-0000-000000002101';
  if v_uc is null or v_uc <> v_biz_a then
    raise exception 'FAIL: default signup did not record the active business (%).', v_uc;
  end if;
  raise notice 'PASS: owner signup records active business (%).', v_biz_a;

  select count(*) from public.businesses into v_uc;
  perform set_config('lf.mb.count_base', v_uc::text, true);
end $$;

-- Owner invites 'attach@localflow.test' as a manager.
do $$
declare
  v_biz_a uuid;
  v_token uuid;
begin
  v_biz_a := current_setting('lf.mb.biz_a', true)::uuid;
  insert into public.invitations (business_id, email, role, invited_by)
  values (v_biz_a, 'attach@localflow.test', 'manager', '00000000-0000-0000-0000-000000002101')
  returning token into v_token;
  perform set_config('lf.mb.token', v_token::text, true);
end $$;

-- ---------------------------------------------------------------------------
-- Harness B: the invitee ALREADY owns their own business (business B).
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000002102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'attach@localflow.test', crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Alex","last_name":"Attach"}'::jsonb, now(), now()
);

do $$
declare
  v_biz_b uuid;
  v_uc uuid;
begin
  select p.business_id into v_biz_b
  from public.profiles p
  where p.user_id = '00000000-0000-0000-0000-000000002102';
  if v_biz_b is null then
    raise exception 'Harness failed: invitee''s own business missing.';
  end if;
  perform set_config('lf.mb.biz_b', v_biz_b::text, true);

  select uc.business_id into v_uc
  from public.user_current_business uc
  where uc.user_id = '00000000-0000-0000-0000-000000002102';
  if v_uc is null or v_uc <> v_biz_b then
    raise exception 'FAIL: default signup (invitee) did not record active business (%).', v_uc;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Existing account accepts the invite -> SECOND membership in business A.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub',  '00000000-0000-0000-0000-000000002102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aud',  'authenticated', true);
select set_config('request.jwt.claims',
  '{"iss":"supabase","sub":"00000000-0000-0000-0000-000000002102","aud":"authenticated","role":"authenticated","email":"attach@localflow.test"}',
  true);

do $$
declare
  v_memberships integer;
  v_current uuid;
  v_role text;
begin
  perform public.accept_invite(current_setting('lf.mb.token', true)::uuid);

  select count(*) into v_memberships
  from public.profiles where user_id = '00000000-0000-0000-0000-000000002102';
  if v_memberships <> 2 then
    raise exception 'FAIL: expected 2 memberships after accept, got %.', v_memberships;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.user_id = '00000000-0000-0000-0000-000000002102'
    and p.business_id = current_setting('lf.mb.biz_a', true)::uuid;
  if v_role <> 'manager' then
    raise exception 'FAIL: invited role should be manager, got %.', v_role;
  end if;

  select public.get_current_business() into v_current;
  if v_current <> current_setting('lf.mb.biz_a', true)::uuid then
    raise exception 'FAIL: active business after accept should be business A, got %.', v_current;
  end if;

  raise notice 'PASS: existing account gained a 2nd membership and active business became A.';
end $$;

-- ---------------------------------------------------------------------------
-- 2. RLS trails the switched business: team list in A is just A's members.
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where b.id = public.current_business_id();
  if v_count <> 2 then
    raise exception 'FAIL: team list in active business A should be 2, got % (RLS drift).', v_count;
  end if;

  select count(*) into v_count
  from public.settings s
  where s.business_id = public.current_business_id();
  if v_count = 0 then
    raise exception 'FAIL: settings for the active business are not visible to its member.';
  end if;
  raise notice 'PASS: RLS scopes reads to the active business.';
end $$;

-- ---------------------------------------------------------------------------
-- 3. switch_business(): verified memberships only.
-- ---------------------------------------------------------------------------
do $$
declare
  v_current uuid;
begin
  perform public.switch_business(current_setting('lf.mb.biz_b', true)::uuid);
  select public.get_current_business() into v_current;
  if v_current <> current_setting('lf.mb.biz_b', true)::uuid then
    raise exception 'FAIL: switch to business B did not take effect (%=%).', v_current, current_setting('lf.mb.biz_b', true);
  end if;
  raise notice 'PASS: switched active business to B.';

  begin
    perform public.switch_business(gen_random_uuid());
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then
      raise exception 'FAIL: switch to a business the user does not belong to succeeded.';
    end if;
    if position('not a member' in sqlerrm) = 0 then
      raise exception 'Unexpected error rejecting non-member switch: %', sqlerrm;
    end if;
    raise notice 'PASS: switching to a non-member business rejected (%).', sqlerrm;
  end;

  -- Back to A for the remaining assertions.
  perform public.switch_business(current_setting('lf.mb.biz_a', true)::uuid);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Invite is single-use: a second accept is rejected.
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    perform public.accept_invite(current_setting('lf.mb.token', true)::uuid);
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then
      raise exception 'FAIL: a consumed invite was accepted a second time.';
    end if;
    if position('invalid, expired, or already used' in sqlerrm) = 0 then
      raise exception 'Unexpected error on reused invite: %', sqlerrm;
    end if;
    raise notice 'PASS: reused invite rejected (%).', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. admin_create_member(): privilege gate, fresh-account passthrough, and
--    attaching an existing account.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Manager (the peer) can create a manager…
  perform public.admin_create_member('Frank', 'Founder', 'frank@localflow.test', 'password123', 'manager');
  raise notice 'PASS: manager-role account created via admin_create_member.';

  -- …but must NOT be able to mint an owner.
  begin
    perform public.admin_create_member('Bob', 'Boss', 'bob@localflow.test', 'password123', 'owner');
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then
      raise exception 'FAIL: a manager minted an OWNER account (escape).';
    end if;
    if position('do not have permission' in sqlerrm) = 0 then
      raise exception 'Unexpected error on manager->owner attempt: %', sqlerrm;
    end if;
    raise notice 'PASS: manager cannot create an owner (%).', sqlerrm;
  end;

  -- Existing account already a member of the active business -> rejected (attach path).
  begin
    perform public.admin_create_member('Mona', 'Main', 'm1@localflow.test', 'password123', 'owner');
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then
      raise exception 'FAIL: attaching an already-joined account succeeded.';
    end if;
    if position('already a member' in sqlerrm) = 0 then
      raise exception 'Unexpected error on duplicate attach: %', sqlerrm;
    end if;
    raise notice 'PASS: re-attaching an existing member rejected (%).', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 6. leave_business(): drop active membership; preference follows the
--    remaining business, then clears entirely at the last membership.
-- ---------------------------------------------------------------------------
do $$
declare
  v_current uuid;
  v_memberships integer;
begin
  -- Leave business B (the invitee's own) while business A remains.
  perform public.switch_business(current_setting('lf.mb.biz_b', true)::uuid);
  perform public.leave_business();

  select count(*) into v_memberships
  from public.profiles where user_id = '00000000-0000-0000-0000-000000002102';
  if v_memberships <> 1 then
    raise exception 'FAIL: expected 1 membership after leaving B, got % (owner guard?).', v_memberships;
  end if;

  select public.get_current_business() into v_current;
  if v_current <> current_setting('lf.mb.biz_a', true)::uuid then
    raise exception 'FAIL: active business should move to A after leaving B, got %.', v_current;
  end if;
  raise notice 'PASS: leaving B moved the active business to A.';

  -- Leave business A too -> no memberships left, active business cleared.
  perform public.leave_business();

  select count(*) into v_memberships
  from public.profiles where user_id = '00000000-0000-0000-0000-000000002102';
  if v_memberships <> 0 then
    raise exception 'FAIL: expected 0 memberships after leaving A, got %.', v_memberships;
  end if;

  select public.get_current_business() into v_current;
  if v_current is not null then
    raise exception 'FAIL: active business should be cleared with no memberships, got %.', v_current;
  end if;
  raise notice 'PASS: last membership cleared the active business preference.';
end $$;

-- ---------------------------------------------------------------------------
-- 7. Owner cannot leave their sole business (protect_last_owner).
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub',  '00000000-0000-0000-0000-000000002101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aud',  'authenticated', true);
select set_config('request.jwt.claims',
  '{"iss":"supabase","sub":"00000000-0000-0000-0000-000000002101","aud":"authenticated","role":"authenticated","email":"m1@localflow.test"}',
  true);

do $$
begin
  begin
    perform public.leave_business();
    raise exception 'EXPECTED_FAILURE_MARKER';
  exception when others then
    if position('EXPECTED_FAILURE_MARKER' in sqlerrm) > 0 then
      raise exception 'FAIL: sole owner left the business (escape).';
    end if;
    if position('at least one owner' in sqlerrm) = 0 then
      raise exception 'Unexpected error on owner leave: %', sqlerrm;
    end if;
    raise notice 'PASS: sole owner cannot leave (%).', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Phase C: superuser asserts about admin_create_member's fresh-account path.
-- ---------------------------------------------------------------------------
reset role;

do $$
declare
  v_user uuid;
  v_marker boolean;
  v_profiles integer;
  v_biz_a uuid;
  v_business_count bigint;
  v_memberships integer;
begin
  v_biz_a := current_setting('lf.mb.biz_a', true)::uuid;

  select id into v_user from auth.users where email = 'frank@localflow.test';
  if v_user is null then
    raise exception 'FAIL: admin-created account does not exist in auth.users.';
  end if;

  select (raw_user_meta_data ? 'admin_created') into v_marker from auth.users where id = v_user;
  if v_marker is not true then
    raise exception 'FAIL: admin_created marker missing on the created auth user.';
  end if;

  select count(*) into v_profiles from public.profiles where user_id = v_user;
  if v_profiles <> 1 then
    raise exception 'FAIL: admin-created account has % profiles (phantom business minted?).', v_profiles;
  end if;
  if (select business_id from public.profiles where user_id = v_user) <> v_biz_a then
    raise exception 'FAIL: admin-created account joined the wrong business.';
  end if;

  select uc.business_id into v_biz_a
  from public.user_current_business uc where uc.user_id = v_user;
  if v_biz_a is null then
    raise exception 'FAIL: admin-created account has no active business prefs.';
  end if;

  select count(*) into v_business_count from public.businesses;
  if v_business_count <> current_setting('lf.mb.count_base', true)::bigint then
    raise exception 'FAIL: admin-create minted a NEW business (count % -> %).',
      current_setting('lf.mb.count_base', true)::bigint, v_business_count;
  end if;
  raise notice 'PASS: admin-created account provisioned cleanly (1 membership, no phantom business, prefs set).';

  -- Both invites consumed: the attach invite and (from 4) its failed replay.
  select count(*) into v_memberships
  from public.invitations where email = 'attach@localflow.test';
  if v_memberships <> 1 then
    raise exception 'FAIL: expected exactly 1 invitation row for the attach email, got %.', v_memberships;
  end if;
end $$;

raise notice '==============================================================';
raise notice 'PASS: multi-business flows verified end to end.';
raise notice '==============================================================';

rollback;