-- Seed a default dashboard_config row for every existing business.
-- The dashboard_config key stores a JSON blob of overridable per-business
-- presentation settings (KPI cards, quick actions, nav labels).
-- Safe to run repeatedly: existing rows are left untouched.

-- Insert a default config for businesses that don't already have one.
-- The default is minimal: an empty override means the frontend falls back
-- to the built-in per-type defaults (see src/config/businessTypes.ts).
insert into public.settings (business_id, key, value)
select b.id, 'dashboard_config', '{}'
from public.businesses b
where not exists (
  select 1 from public.settings s
  where s.business_id = b.id and s.key = 'dashboard_config'
)
on conflict (business_id, key) do nothing;
