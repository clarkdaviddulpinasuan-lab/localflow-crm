-- 012_resources.sql
-- Create the resources table for managing bookable resources (rooms, tables, etc.)

create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  type        text not null default 'resource',
  color       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_resources_business_id on public.resources(business_id);
create index idx_resources_name on public.resources(business_id, name);
create index idx_resources_active on public.resources(business_id, active);

alter table public.resources enable row level security;

create policy "resources_select_business" on public.resources
  for select using (business_id = public.current_business_id());

create policy "resources_insert_business" on public.resources
  for insert with check (business_id = public.current_business_id());

create policy "resources_update_business" on public.resources
  for update using (business_id = public.current_business_id());

create policy "resources_delete_business" on public.resources
  for delete using (business_id = public.current_business_id());
