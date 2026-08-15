-- public.personal_data_relation_manifest shipped in 20260812050000 with grants
-- but no row-level security, leaving it the only public table in the schema
-- that neither enables nor forces RLS. Grants alone are the weaker half of the
-- pair the rest of the schema relies on: a later grant, a new role, or a
-- table-owner write path would reach these rows unchecked, and the manifest is
-- the definition of which relations carry personal data.
--
-- Reads are unaffected. service_role and postgres both hold BYPASSRLS, and the
-- readers here are SECURITY DEFINER functions owned by postgres, so
-- admin_export_customer_data and admin_erase_customer_pii keep working exactly
-- as before. anon and authenticated were already revoked in 20260812050000 and
-- get no policy, so they continue to see nothing.
--
-- Mirrors the registry-table shape established for public.operational_cron_jobs
-- in 20260723113000_production_operational_signals.sql.
alter table public.personal_data_relation_manifest enable row level security;
alter table public.personal_data_relation_manifest force row level security;

drop policy if exists personal_data_relation_manifest_service_read
  on public.personal_data_relation_manifest;
create policy personal_data_relation_manifest_service_read
  on public.personal_data_relation_manifest
  for select to service_role
  using (true);

notify pgrst, 'reload schema';
