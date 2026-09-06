-- ============================================================================
-- LocalFlow CRM - Team invitations: multiple accounts sharing ONE business
--
-- Before this migration, every new signup created its OWN business (migration
-- 010), and the "Add Member" flow only worked in tests (it inserted a profiles
-- row without a user_id, which the real schema rejects).
--
-- This migration adds the missing piece: invitations. An owner/manager sends an
-- invite (email + role + token); the invitee signs up at /signup?invite=<token>;
-- the signup trigger then attaches the new account to the INVITER's business
-- instead of minting a fresh one. The token is validated server-side in SQL, so
-- no client can force-join a business without a valid, pending, unexpired invite.
--
-- Safe to run repeatedly.
-- ============================================================================

-- ============================================================
-- INVITATIONS
-- ============================================================
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role user_role not null default 'staff',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create unique index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_business_id on public.invitations(business_id);
create index if not exists idx_invitations_email on public.invitations(email);

-- One pending invite per email per business.
create unique index if not exists idx_invitations_pending_email
  on public.invitations (business_id, lower(email))
  where status = 'pending';

drop trigger if exists invitations_updated_at on public.invitations;
create trigger invitations_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

-- ============================================================
-- HELPER: role gating for who may invite (owners, and managers
-- inviting anything except another owner)
-- ============================================================
create or replace function public.current_user_can_invite(p_role user_role)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.business_id = public.current_business_id()
      and (p.role = 'owner' or (p.role = 'manager' and p_role <> 'owner'))
  );
$$;

grant execute on function public.current_user_can_invite(user_role) to anon, authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.invitations enable row level security;

-- Only the business can see its own pending invites.
drop policy if exists "invitations_select_business" on public.invitations;
create policy "invitations_select_business"
  on public.invitations for select
  using (business_id = public.current_business_id());

drop policy if exists "invitations_insert_business" on public.invitations;
create policy "invitations_insert_business"
  on public.invitations for insert
  with check (
    business_id = public.current_business_id()
    and public.current_user_can_invite(role)
  );

-- Revoking an invite = deleting it; same role gating as creating one.
drop policy if exists "invitations_delete_business" on public.invitations;
create policy "invitations_delete_business"
  on public.invitations for delete
  using (
    business_id = public.current_business_id()
    and public.current_user_can_invite(role)
  );

-- ============================================================
-- INVITE SUMMARY for the public signup page (anon-readable)
-- Returns only the business name + inviter for a VALID pending
-- token, so the invitee sees "Almar invited you to X". The token
-- is an unguessable UUID that only the invited party holds.
-- ============================================================
create or replace function public.get_invite_summary(p_token uuid)
returns table (business_name text, invited_by text)
language sql stable security definer set search_path = public as $$
  select b.name, p.first_name || ' ' || p.last_name
  from public.invitations i
  join public.businesses b on b.id = i.business_id
  join public.profiles p on p.user_id = i.invited_by
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;
$$;

grant execute on function public.get_invite_summary(uuid) to anon, authenticated, service_role;

-- ============================================================
-- SIGNUP TRIGGER: attach invitees to an existing business
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

  -- ---- Default path (migration 010 behavior): fresh business per signup ----
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- LAST-OWNER GUARD: a business must keep at least one owner
-- ============================================================
create or replace function public.protect_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owners int;
begin
  select count(*) into v_owners
  from public.profiles
  where business_id = old.business_id and role = 'owner';

  if old.role = 'owner' and v_owners <= 1 then
    if tg_op = 'DELETE' or (new.role is distinct from old.role and new.role <> 'owner') then
      raise exception 'A business must keep at least one owner.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_protect_last_owner on public.profiles;
create trigger profiles_protect_last_owner
  before delete or update of role on public.profiles
  for each row execute function public.protect_last_owner();