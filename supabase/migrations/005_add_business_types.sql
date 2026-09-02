-- Add the remaining business types from the product spec.
-- ALTER TYPE ... ADD VALUE is supported on Postgres 13+ (Supabase runs 15+).
-- Values must be added one per statement because each ALTER TYPE acquires a
-- lock on the enum type.

alter type business_type add value if not exists 'homestay';
alter type business_type add value if not exists 'salon';
alter type business_type add value if not exists 'beauty';
alter type business_type add value if not exists 'tour_operator';
alter type business_type add value if not exists 'agency';