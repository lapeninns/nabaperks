-- Canonical venue address metadata for Loqate-backed UK address selection.
-- Keeps the existing free-text `address`, `latitude`, `longitude`, and
-- `geocoded_at` columns for backward compatibility; adds structured lines, the
-- provider identity used to re-verify a selection, and the entry source so
-- reads can distinguish a looked-up address from a manual fallback.
-- Idempotent: safe to re-apply on every `db:migrate` run.

alter table public.merchant_locations
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists address_city text,
  add column if not exists address_postcode text,
  add column if not exists address_country text,
  add column if not exists address_provider text,
  add column if not exists address_provider_id text,
  add column if not exists address_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchant_locations_address_source_check'
      and conrelid = 'public.merchant_locations'::regclass
  ) then
    alter table public.merchant_locations
      add constraint merchant_locations_address_source_check
      check (
        address_source is null
        or address_source in ('provider_lookup', 'manual_entry')
      );
  end if;
end;
$$;
