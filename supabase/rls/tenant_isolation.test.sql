-- ============================================================================
-- LocalFlow CRM — RLS tenant-isolation adversarial test
--
-- Proves a user belonging to Tenant A cannot read, update, or delete any row
-- that belongs to Tenant B across every RLS-protected table, using the exact
-- lookups an attacker would (rows addressed by their known IDs).
--
-- HOW IT WORKS
--   1. Creates two real tenants exactly like production signups do — through
--      the on_auth_user_created trigger (migration 010) — then seeds Tenant B
--      with one row in every RLS-protected table. Every seeded ID is stashed in
--      transaction-local settings before the role switch.
--   2. Switches the session to the `authenticated` role and injects JWT claims
--      that impersonate Tenant A (the canonical Supabase test technique).
--   3. Attempts SELECT / UPDATE / DELETE against every Tenant B row by that
--      stashed ID. Every attempt must affect ZERO rows; any leak raises.
--   4. Rolls back at the end, so the test permanently adds/removes nothing.
--
-- REQUIREMENTS
--   * Run as a role that bypasses RLS and can SET ROLE to "authenticated"
--     (postgres / supabase_admin / a superuser).
--   * Run against a schema where migrations 001-018 are applied and the `auth`
--     schema helpers exist (any Supabase project, local or hosted).
--   * Migration 010 must be applied (the two tenants must get separate
--     businesses); the script verifies this itself.
--
-- USAGE
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/rls/tenant_isolation.test.sql
--   PowerShell: .\supabase\rls\run-tenant-isolation-test.ps1 -ConnectionString $env:DATABASE_URL
--
-- If any table fails these assertions, stop and fix its RLS policy immediately —
-- this is a P0 security gate, not a backlog item.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- 1. Provision two isolated tenants through the real signup trigger.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'tenant-a@localflow.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Tenant","last_name":"A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'tenant-b@localflow.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Tenant","last_name":"B"}'::jsonb, now(), now());

-- Sanity: migration 010 replaced the original trigger, so each tenant must have
-- received its OWN business. If they share one, the signup trigger regressed to
-- the old single-tenant version and that itself is the bug.
do $$
declare
  v_count bigint;
begin
  select count(distinct p.business_id)
  into v_count
  from public.profiles p
  where p.user_id in (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  );

  if v_count <> 2 then
    raise exception 'Tenant isolation precondition failed: the two tenant signups landed in the same business (migration 010 not applied?). Found % distinct businesses.', v_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Seed one row for Tenant B in every RLS-protected table, and stash every
--    seeded ID in transaction-local settings. The assertion block runs as the
--    attacker (Tenant A), so it cannot re-derive these IDs by querying.
-- ---------------------------------------------------------------------------
do $$
declare
  v_biz_b       uuid;
  v_profile_b   uuid;
  v_customer_b  uuid;
  v_resource_b  uuid;
  v_booking_b   uuid;
  v_order_b     uuid;
  v_task_b      uuid;
  v_lead_b      uuid;
  v_activity_b  uuid;
  v_template_b  uuid;
  v_comm_b      uuid;
  v_followup_b  uuid;
  v_note_b      uuid;
  v_item_b      uuid;
  v_setting_b   uuid;
  v_notif_b     uuid;
  v_invite_b    uuid;
begin
  select p.business_id, p.id into v_biz_b, v_profile_b
  from public.profiles p where p.user_id = '00000000-0000-0000-0000-000000000002';

  insert into public.customers (business_id, first_name, last_name, email)
  values (v_biz_b, 'Bob', 'TenantB', 'bob-b@localflow.test')
  returning id into v_customer_b;

  insert into public.resources (business_id, name, type)
  values (v_biz_b, 'Tenant B private beach villa', 'room')
  returning id into v_resource_b;

  insert into public.bookings (business_id, customer_id, resource, date, start_time, end_time, guests, status, amount, payment_status)
  values (v_biz_b, v_customer_b, 'Tenant B private beach villa', current_date, '14:00', '12:00', 2, 'confirmed', 5000, 'pending')
  returning id into v_booking_b;

  insert into public.booking_items (business_id, booking_id, name, quantity, unit_price, category)
  values (v_biz_b, v_booking_b, 'Massage for Tenant B', 1, 1500, 'spa')
  returning id into v_item_b;

  insert into public.orders (business_id, customer_id, order_number, items, description, total, payment_status, status)
  values (v_biz_b, v_customer_b, 'ORD-TENANT-B', 'Tenant B private order line', 'Tenant B private order', 1000, 'pending', 'new')
  returning id into v_order_b;

  insert into public.tasks (business_id, customer_id, title, description, due_date, priority, status)
  values (v_biz_b, v_customer_b, 'Tenant B private task', 'Tenant B private task detail', current_date, 'high', 'todo')
  returning id into v_task_b;

  insert into public.leads (business_id, name, company, email, stage, estimated_value)
  values (v_biz_b, 'Tenant B private lead', 'Tenant B Inc', 'lead-b@localflow.test', 'new', 0)
  returning id into v_lead_b;

  insert into public.activities (business_id, user_id, action, entity_type, entity_id, description)
  values (v_biz_b, v_profile_b, 'test_seed', 'tenant_b', 'seed', 'Tenant B private activity')
  returning id into v_activity_b;

  insert into public.message_templates (business_id, name, channel, subject, body)
  values (v_biz_b, 'Tenant B private template', 'sms', 'Tenant B subject', 'Tenant B private body')
  returning id into v_template_b;

  insert into public.communications (business_id, customer_id, channel, template_id, subject, body)
  values (v_biz_b, v_customer_b, 'sms', v_template_b, 'Tenant B subject', 'Tenant B private message')
  returning id into v_comm_b;

  insert into public.follow_ups (business_id, customer_id, due_date, note, status)
  values (v_biz_b, v_customer_b, current_date, 'Tenant B private follow-up', 'pending')
  returning id into v_followup_b;

  insert into public.customer_notes (customer_id, business_id, author_id, content)
  values (v_customer_b, v_biz_b, v_profile_b, 'Tenant B private note')
  returning id into v_note_b;

  insert into public.settings (business_id, key, value)
  values (v_biz_b, 'tenant_isolation_test', 'secret')
  on conflict (business_id, key) do nothing
  returning id into v_setting_b;

  insert into public.notifications (user_id, business_id, title, message, type)
  values ('00000000-0000-0000-0000-000000000002', v_biz_b, 'Tenant B notification', 'Tenant B private notification', 'system')
  returning id into v_notif_b;

  insert into public.invitations (business_id, email, role, invited_by, status, expires_at)
  values (v_biz_b, 'invite-b@localflow.test', 'staff', '00000000-0000-0000-0000-000000000002', 'pending', now() + interval '7 days')
  returning id into v_invite_b;

  insert into public.user_current_business (user_id, business_id, updated_at)
  values ('00000000-0000-0000-0000-000000000002', v_biz_b, now());

  -- Stash every seeded ID (plus Tenant A's business for the control checks).
  perform set_config('lf.test.biz_a',      (select p.business_id from public.profiles p where p.user_id = '00000000-0000-0000-0000-000000000001')::text, true);
  perform set_config('lf.test.biz_b',      v_biz_b::text,      true);
  perform set_config('lf.test.profile_b',  v_profile_b::text,  true);
  perform set_config('lf.test.customer_b', v_customer_b::text, true);
  perform set_config('lf.test.resource_b', v_resource_b::text, true);
  perform set_config('lf.test.booking_b',  v_booking_b::text,  true);
  perform set_config('lf.test.item_b',     v_item_b::text,     true);
  perform set_config('lf.test.order_b',    v_order_b::text,    true);
  perform set_config('lf.test.task_b',     v_task_b::text,     true);
  perform set_config('lf.test.lead_b',     v_lead_b::text,     true);
  perform set_config('lf.test.activity_b', v_activity_b::text, true);
  perform set_config('lf.test.template_b', v_template_b::text, true);
  perform set_config('lf.test.comm_b',     v_comm_b::text,     true);
  perform set_config('lf.test.followup_b', v_followup_b::text, true);
  perform set_config('lf.test.note_b',     v_note_b::text,     true);
  perform set_config('lf.test.setting_b',  v_setting_b::text,  true);
  perform set_config('lf.test.notif_b',    v_notif_b::text,    true);
  perform set_config('lf.test.invite_b',   v_invite_b::text,   true);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Become the attacker: Tenant A, authenticated role, forged JWT claims.
-- ---------------------------------------------------------------------------
set local role authenticated;

select set_config('request.jwt.claim.sub',  '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aud',  'authenticated', true);
select set_config('request.jwt.claims',
  '{"iss":"supabase","sub":"00000000-0000-0000-0000-000000000001","aud":"authenticated","role":"authenticated","email":"tenant-a@localflow.test"}',
  true);

-- ---------------------------------------------------------------------------
-- 4. Assertions. Every count/row-count below MUST be 0, because Tenant A holds
--    the ID but holds no relationship to Tenant B's rows. Any 1+ leaks.
-- ---------------------------------------------------------------------------
do $$
declare
  v_biz_a       uuid;
  v_biz_b       uuid;
  v_profile_b   uuid;
  v_customer_b  uuid;
  v_resource_b  uuid;
  v_booking_b   uuid;
  v_item_b      uuid;
  v_order_b     uuid;
  v_task_b      uuid;
  v_lead_b      uuid;
  v_activity_b  uuid;
  v_template_b  uuid;
  v_comm_b      uuid;
  v_followup_b  uuid;
  v_note_b      uuid;
  v_setting_b   uuid;
  v_notif_b     uuid;
  v_invite_b    uuid;
  v_visible     bigint;
  v_affected    integer;
begin
  v_biz_a       := current_setting('lf.test.biz_a', true)::uuid;
  v_biz_b       := current_setting('lf.test.biz_b', true)::uuid;
  v_profile_b   := current_setting('lf.test.profile_b', true)::uuid;
  v_customer_b  := current_setting('lf.test.customer_b', true)::uuid;
  v_resource_b  := current_setting('lf.test.resource_b', true)::uuid;
  v_booking_b   := current_setting('lf.test.booking_b', true)::uuid;
  v_item_b      := current_setting('lf.test.item_b', true)::uuid;
  v_order_b     := current_setting('lf.test.order_b', true)::uuid;
  v_task_b      := current_setting('lf.test.task_b', true)::uuid;
  v_lead_b      := current_setting('lf.test.lead_b', true)::uuid;
  v_activity_b  := current_setting('lf.test.activity_b', true)::uuid;
  v_template_b  := current_setting('lf.test.template_b', true)::uuid;
  v_comm_b      := current_setting('lf.test.comm_b', true)::uuid;
  v_followup_b  := current_setting('lf.test.followup_b', true)::uuid;
  v_note_b      := current_setting('lf.test.note_b', true)::uuid;
  v_setting_b   := current_setting('lf.test.setting_b', true)::uuid;
  v_notif_b     := current_setting('lf.test.notif_b', true)::uuid;
  v_invite_b    := current_setting('lf.test.invite_b', true)::uuid;

  -- ---- Controls: prove the attacker really is authenticated Tenant A ------
  select count(*) into v_visible from public.businesses where id = v_biz_a;
  if v_visible <> 1 then
    raise exception 'Control failed: Tenant A cannot read their own business (impersonation broken).';
  end if;
  raise notice 'Control OK: Tenant A (role=authenticated) can read their own business %.', v_biz_a;

  select count(*) into v_visible from public.profiles where user_id = auth.uid();
  if v_visible = 0 then
    raise exception 'Control failed: Tenant A profile not visible (impersonation broken).';
  end if;
  raise notice 'Control OK: auth.uid() resolves to Tenant A (%/%).', auth.uid(), current_setting('lf.test.biz_a', true);

  -- ---- businesses / profiles -------------------------------------------------
  select count(*) into v_visible from public.businesses where id = v_biz_b;
  if v_visible <> 0 then raise exception 'Biz: Tenant A read Tenant B business.'; end if;
  update public.businesses set name = 'HACKED' where id = v_biz_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Biz: Tenant A updated Tenant B business.'; end if;
  delete from public.businesses where id = v_biz_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Biz: Tenant A deleted Tenant B business.'; end if;
  raise notice 'OK businesses';

  select count(*) into v_visible from public.profiles where id = v_profile_b;
  if v_visible <> 0 then raise exception 'Profiles: Tenant A read Tenant B profile.'; end if;
  update public.profiles set first_name = 'HACKED' where id = v_profile_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Profiles: Tenant A updated Tenant B profile.'; end if;
  delete from public.profiles where id = v_profile_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Profiles: Tenant A deleted Tenant B profile.'; end if;
  raise notice 'OK profiles';

  -- ---- customers / customer_notes ---------------------------------------------
  select count(*) into v_visible from public.customers where id = v_customer_b;
  if v_visible <> 0 then raise exception 'Customers: Tenant A read Tenant B customer.'; end if;
  update public.customers set last_name = 'HACKED' where id = v_customer_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Customers: Tenant A updated Tenant B customer.'; end if;
  delete from public.customers where id = v_customer_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Customers: Tenant A deleted Tenant B customer.'; end if;
  raise notice 'OK customers';

  select count(*) into v_visible from public.customer_notes where id = v_note_b;
  if v_visible <> 0 then raise exception 'Notes: Tenant A read Tenant B note.'; end if;
  update public.customer_notes set content = 'HACKED' where id = v_note_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Notes: Tenant A updated Tenant B note.'; end if;
  delete from public.customer_notes where id = v_note_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Notes: Tenant A deleted Tenant B note.'; end if;
  raise notice 'OK customer_notes';

  -- ---- bookings / booking_items -------------------------------------------------
  select count(*) into v_visible from public.bookings where id = v_booking_b;
  if v_visible <> 0 then raise exception 'Bookings: Tenant A read Tenant B booking.'; end if;
  update public.bookings set notes = 'HACKED' where id = v_booking_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Bookings: Tenant A updated Tenant B booking.'; end if;
  delete from public.bookings where id = v_booking_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Bookings: Tenant A deleted Tenant B booking.'; end if;
  raise notice 'OK bookings';

  select count(*) into v_visible from public.booking_items where id = v_item_b;
  if v_visible <> 0 then raise exception 'Booking items: Tenant A read a Tenant B item.'; end if;
  update public.booking_items set notes = 'HACKED' where id = v_item_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Booking items: Tenant A updated a Tenant B item.'; end if;
  delete from public.booking_items where id = v_item_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Booking items: Tenant A deleted a Tenant B item.'; end if;
  raise notice 'OK booking_items';

  -- ---- orders / tasks / leads -----------------------------------------------------
  select count(*) into v_visible from public.orders where id = v_order_b;
  if v_visible <> 0 then raise exception 'Orders: Tenant A read Tenant B order.'; end if;
  update public.orders set description = 'HACKED' where id = v_order_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Orders: Tenant A updated Tenant B order.'; end if;
  delete from public.orders where id = v_order_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Orders: Tenant A deleted Tenant B order.'; end if;
  raise notice 'OK orders';

  select count(*) into v_visible from public.tasks where id = v_task_b;
  if v_visible <> 0 then raise exception 'Tasks: Tenant A read Tenant B task.'; end if;
  update public.tasks set title = 'HACKED' where id = v_task_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Tasks: Tenant A updated Tenant B task.'; end if;
  delete from public.tasks where id = v_task_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Tasks: Tenant A deleted Tenant B task.'; end if;
  raise notice 'OK tasks';

  select count(*) into v_visible from public.leads where id = v_lead_b;
  if v_visible <> 0 then raise exception 'Leads: Tenant A read Tenant B lead.'; end if;
  update public.leads set name = 'HACKED' where id = v_lead_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Leads: Tenant A updated Tenant B lead.'; end if;
  delete from public.leads where id = v_lead_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Leads: Tenant A deleted Tenant B lead.'; end if;
  raise notice 'OK leads';

  -- ---- activities / templates / communications --------------------------------------
  select count(*) into v_visible from public.activities where id = v_activity_b;
  if v_visible <> 0 then raise exception 'Activities: Tenant A read Tenant B activity.'; end if;
  update public.activities set description = 'HACKED' where id = v_activity_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Activities: Tenant A updated Tenant B activity.'; end if;
  delete from public.activities where id = v_activity_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Activities: Tenant A deleted Tenant B activity.'; end if;
  raise notice 'OK activities';

  select count(*) into v_visible from public.message_templates where id = v_template_b;
  if v_visible <> 0 then raise exception 'Templates: Tenant A read Tenant B template.'; end if;
  update public.message_templates set body = 'HACKED' where id = v_template_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Templates: Tenant A updated Tenant B template.'; end if;
  delete from public.message_templates where id = v_template_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Templates: Tenant A deleted Tenant B template.'; end if;
  raise notice 'OK message_templates';

  select count(*) into v_visible from public.communications where id = v_comm_b;
  if v_visible <> 0 then raise exception 'Comms: Tenant A read Tenant B communication.'; end if;
  update public.communications set body = 'HACKED' where id = v_comm_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Comms: Tenant A updated Tenant B communication.'; end if;
  delete from public.communications where id = v_comm_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Comms: Tenant A deleted Tenant B communication.'; end if;
  raise notice 'OK communications';

  -- ---- follow_ups / resources / settings / notifications -----------------------------
  select count(*) into v_visible from public.follow_ups where id = v_followup_b;
  if v_visible <> 0 then raise exception 'Follow-ups: Tenant A read Tenant B follow-up.'; end if;
  update public.follow_ups set note = 'HACKED' where id = v_followup_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Follow-ups: Tenant A updated Tenant B follow-up.'; end if;
  delete from public.follow_ups where id = v_followup_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Follow-ups: Tenant A deleted Tenant B follow-up.'; end if;
  raise notice 'OK follow_ups';

  select count(*) into v_visible from public.resources where id = v_resource_b;
  if v_visible <> 0 then raise exception 'Resources: Tenant A read Tenant B resource.'; end if;
  update public.resources set name = 'HACKED' where id = v_resource_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Resources: Tenant A updated Tenant B resource.'; end if;
  delete from public.resources where id = v_resource_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Resources: Tenant A deleted Tenant B resource.'; end if;
  raise notice 'OK resources';

  select count(*) into v_visible from public.settings where id = v_setting_b;
  if v_visible <> 0 then raise exception 'Settings: Tenant A read Tenant B setting.'; end if;
  update public.settings set value = 'HACKED' where id = v_setting_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Settings: Tenant A updated Tenant B setting.'; end if;
  delete from public.settings where id = v_setting_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Settings: Tenant A deleted Tenant B setting.'; end if;
  raise notice 'OK settings';

  select count(*) into v_visible from public.notifications where id = v_notif_b;
  if v_visible <> 0 then raise exception 'Notifications: Tenant A read Tenant B notification.'; end if;
  update public.notifications set message = 'HACKED' where id = v_notif_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Notifications: Tenant A updated Tenant B notification.'; end if;
  delete from public.notifications where id = v_notif_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Notifications: Tenant A deleted Tenant B notification.'; end if;
  raise notice 'OK notifications';

  -- ---- invitations (017) / user_current_business (018) -------------------------
  select count(*) into v_visible from public.invitations where id = v_invite_b;
  if v_visible <> 0 then raise exception 'Invites: Tenant A read Tenant B invitation.'; end if;
  update public.invitations set status = 'accepted' where id = v_invite_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Invites: Tenant A updated Tenant B invitation.'; end if;
  delete from public.invitations where id = v_invite_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Invites: Tenant A deleted Tenant B invitation.'; end if;
  raise notice 'OK invitations';

  -- user_current_business deliberately has NO direct policies (migration 018):
  -- only security definer functions touch it, so a leaked read/write here would
  -- mean a huge design break. The attacker's own preference row is the control.
  select count(*) into v_visible from public.user_current_business
  where user_id = '00000000-0000-0000-0000-000000000002';
  if v_visible <> 0 then raise exception 'Active pref: Tenant A read Tenant B active-business preference.'; end if;
  update public.user_current_business set updated_at = now()
  where user_id = '00000000-0000-0000-0000-000000000002';
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Active pref: Tenant A updated Tenant B active-business preference.'; end if;
  delete from public.user_current_business
  where user_id = '00000000-0000-0000-0000-000000000002';
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then raise exception 'Active pref: Tenant A deleted Tenant B active-business preference.'; end if;
  raise notice 'OK user_current_business';

  raise notice '==============================================================';
  raise notice 'PASS: Tenant isolation holds. Tenant A (business %) could not read/update/delete any of Tenant B''s rows (business %) across all 18 RLS-protected tables.', v_biz_a, v_biz_b;
  raise notice '==============================================================';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Roll back: the test leaves no trace behind.
-- ---------------------------------------------------------------------------
rollback;

-- ============================================================================
-- OTHER RLS SURFACES NOT COVERED HERE (checked separately on purpose)
--   * storage.objects — the public `avatars` bucket (migration 016) has its own
--     policies under the `storage` schema, not the public tables above. Bucket
--     containment is intentionally public; re-validate its policies if the
--     bucket's visibility ever changes.
--   * Edge Functions (send-invite, send-message) run service-role and bypass
--     RLS by design. They re-authenticate the caller themselves and scope
--     operations to the caller's own business; review that auth whenever the
--     functions change.
-- ============================================================================