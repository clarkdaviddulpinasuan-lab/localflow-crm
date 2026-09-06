-- ============================================================================
-- LocalFlow CRM - Multi-business membership, admin-created accounts, and
-- self-serve "leave business".
--
-- Migration 017 allowed multiple ACCOUNTS to share one business. This one
-- allows one ACCOUNT to belong to SEVERAL businesses and switch between them
-- (invitees who own a business, team coordinators, etc.), lets an owner/manager
-- create a full account without the invite link, and lets a member leave a
-- business themselves.
--
-- How "current business" works: the browser hits a fresh pooled DB session on
-- every request, so session-scoped claims cannot persist. Each membership keeps
-- a row in user_current_business (the active business per auth user). RLS's
-- current_business_id() reads it first and falls back to a single membership.
-- The row is written at membership creation (signup/join/admin-create) and only
-- ever changes through switch_business() / leave_business().
--
-- Safe to run repeatedly.
-- ============================================================================

-- ============================================================
-- 1. ACTIVE-BUSINESS PREFERENCE per user
-- ============================================================
create table if not exists public.user_current_business (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- No select/update policies: only security definer functions touch this table,
-- so the client can never read or forge another user's preference directly.

-- ============================================================
-- 2. current_business_id(): prefs row first, single membership as fallback
--    (security definer so RLS on profiles/user_current_business never recurses,
--    and create-or-replace so dependent RLS policies are NOT dropped)
-- ============================================================
create or replace function public.current_business_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select uc.business_id from public.user_current_business uc where uc.user_id = auth.uid()),
    (select p.business_id from public.profiles p where p.user_id = auth.uid() limit 1)
  );
$$;

comment on function public.current_business_id() is
  'Active business for the signed-in user: user_current_business first, else the lone membership.';

-- ============================================================
-- 3. RPC: query the active business (client uses this instead of
--    guessing from profiles, so it can never drift from RLS)
-- ============================================================
create or replace function public.get_current_business()
returns uuid language sql stable security definer set search_path = public as $$
  select public.current_business_id();
$$;

grant execute on function public.get_current_business() to anon, authenticated, service_role;

-- ============================================================
-- 4. RPC: switch the active business (validated membership only)
-- ============================================================
create or replace function public.switch_business(p_business_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.business_id = p_business_id
  ) then
    raise exception 'You are not a member of that business.';
  end if;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (auth.uid(), p_business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();
end;
$$;

grant execute on function public.switch_business(uuid) to authenticated;

-- ============================================================
-- 5. RPC: accept a pending invitation with an EXISTING account
--    (an invitee who already has an account signs in and claims
--    the invite: joins the business, consumes the invite, and
--    makes it the active business)
-- ============================================================
create or replace function public.accept_invite(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invitations%rowtype;
  v_dummy uuid;
begin
  select i.* into v_invite
  from public.invitations i
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  for update;

  if v_invite.id is null then
    raise exception 'This invitation is invalid, expired, or already used.';
  end if;

  select id into v_dummy
  from public.profiles
  where user_id = auth.uid() and business_id = v_invite.business_id;
  if v_dummy is not null then
    raise exception 'You are already a member of that business.';
  end if;

  update public.invitations
  set status = 'accepted', accepted_at = now(), accepted_user_id = auth.uid()
  where id = v_invite.id;

  insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
  select auth.uid(), v_invite.business_id,
         coalesce(nullif(trim(raw_user_meta_data->>'first_name'), ''), 'New'),
         coalesce(nullif(trim(raw_user_meta_data->>'last_name'), ''), 'Member'),
         lower(email), v_invite.role
  from auth.users where id = auth.uid()
  on conflict (user_id, business_id) do nothing;

  insert into public.settings (business_id, key, value)
  values (v_invite.business_id, 'dashboard_config', '{}')
  on conflict (business_id, key) do nothing;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (auth.uid(), v_invite.business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

  insert into public.notifications (user_id, business_id, title, message, type)
  values (
    v_invite.invited_by,
    v_invite.business_id,
    'New team member on board',
    'A teammate joined your business.',
    'system'
  );
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ============================================================
-- 6. RPC: leave the active business. Owners are protected by the
--    profiles_protect_last_owner trigger. If other memberships
--    remain, the active preference moves to one of them.
-- ============================================================
create or replace function public.leave_business()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_current uuid;
  v_next uuid;
begin
  select public.current_business_id() into v_current;
  if v_current is null then
    return;
  end if;

  delete from public.profiles
  where user_id = auth.uid() and business_id = v_current;

  delete from public.user_current_business
  where user_id = auth.uid() and business_id = v_current;

  select p.business_id into v_next
  from public.profiles p
  where p.user_id = auth.uid()
  order by p.created_at asc
  limit 1;

  if v_next is not null then
    insert into public.user_current_business (user_id, business_id, updated_at)
    values (auth.uid(), v_next, now())
    on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();
  end if;
end;
$$;

grant execute on function public.leave_business() to authenticated;

-- ============================================================
-- 7. RPC: admin-created account (owner/manager creates a full
--    confirmed account, or attaches an existing one, to the
--    caller's active business)
-- ============================================================
create or replace function public.admin_create_member(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_password text,
  p_role user_role
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_user_id uuid := gen_random_uuid();
  v_existing_user uuid;
  v_name text;
begin
  if not public.current_user_can_invite(p_role) then
    raise exception 'You do not have permission to create an account with that role.';
  end if;
  if nullif(p_first_name, '') is null or nullif(p_last_name, '') is null then
    raise exception 'First and last name are required.';
  end if;
  if nullif(p_email, '') is null or position('@' in p_email) = 0 then
    raise exception 'A valid email is required.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Password must be at least 8 characters.';
  end if;

  select public.current_business_id() into v_business_id;
  if v_business_id is null then
    raise exception 'No active business found.';
  end if;

  -- ---- Existing account? Attach it (unless already a member) ----------------
  select u.id into v_existing_user from auth.users u where lower(u.email) = lower(p_email) limit 1;
  if v_existing_user is not null then
    if exists (
      select 1 from public.profiles p
      where p.user_id = v_existing_user and p.business_id = v_business_id
    ) then
      raise exception 'That account is already a member of this business.';
    end if;

    insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
    values (v_existing_user, v_business_id, p_first_name, p_last_name, lower(trim(p_email)), p_role)
    on conflict (user_id, business_id) do nothing;

    insert into public.user_current_business (user_id, business_id, updated_at)
    values (v_existing_user, v_business_id, now())
    on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

    return v_existing_user;
  end if;

  v_name := p_first_name || ' ' || p_last_name;

  -- ---- New account: insert the auth user directly (mirrors the GoTrue
  --      signup trigger shape). handle_new_user() returns early on the
  --      admin_created marker below, so no phantom business/profile is minted.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    lower(trim(p_email)), crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'admin_created', true),
    now(), now()
  );

  insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
  values (v_user_id, v_business_id, p_first_name, p_last_name, lower(trim(p_email)), p_role)
  on conflict (user_id, business_id) do nothing;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (v_user_id, v_business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

  return v_user_id;
end;
$$;

grant execute on function public.admin_create_member(text, text, text, text, user_role) to authenticated;

-- ============================================================
-- 8. handle_new_user(): honor admin-created passthrough and
--    record the active business for every new membership
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
  v_invite public.invitations%rowtype;
  first_name text;
  last_name text;
  new_business_id uuid;
begin
  first_name := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  last_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), '');

  -- ---- Admin-created accounts provision themselves (migration 018) --------
  if new.raw_user_meta_data ? 'admin_created' then
    return new;
  end if;

  -- ---- Invite path: join an existing business ------------------------------
  if new.raw_user_meta_data ? 'invite_token' then
    begin
      v_token := nullif(new.raw_user_meta_data->>'invite_token', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'This invitation link is not valid.';
    end;

    select i.* into v_invite
    from public.invitations i
    where i.token = v_token
      and i.status = 'pending'
      and i.expires_at > now()
      and lower(i.email) = lower(new.email)
    for update;

    if v_invite.id is null then
      raise exception 'This invitation is invalid, expired, or already used.';
    end if;

    insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
    values (new.id, v_invite.business_id, first_name, last_name, new.email, v_invite.role)
    on conflict (user_id, business_id) do nothing;

    insert into public.settings (business_id, key, value)
    values (v_invite.business_id, 'dashboard_config', '{}')
    on conflict (business_id, key) do nothing;

    insert into public.user_current_business (user_id, business_id, updated_at)
    values (new.id, v_invite.business_id, now())
    on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

    update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_user_id = new.id
    where id = v_invite.id;

    insert into public.notifications (user_id, business_id, title, message, type)
    values (
      v_invite.invited_by,
      v_invite.business_id,
      'New team member on board',
      first_name || ' ' || last_name || ' joined your business.',
      'system'
    );

    return new;
  end if;

  -- ---- Default path: fresh business per signup ------------------------------
  insert into public.businesses (name, type)
  values (
    case
      when first_name = '' then 'My Business'
      else first_name || '''s Business'
    end,
    'other'
  )
  returning id into new_business_id;

  insert into public.profiles (user_id, business_id, first_name, last_name, email, role)
  values (new.id, new_business_id, first_name, last_name, new.email, 'owner')
  on conflict (user_id, business_id) do nothing;

  insert into public.settings (business_id, key, value)
  values (new_business_id, 'dashboard_config', '{}')
  on conflict (business_id, key) do nothing;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values (new.id, new_business_id, now())
  on conflict (user_id) do update set business_id = excluded.business_id, updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();