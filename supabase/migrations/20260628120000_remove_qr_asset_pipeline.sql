drop trigger if exists qr_codes_enqueue_asset_jobs on public.qr_codes;
drop trigger if exists merchants_enqueue_qr_asset_jobs on public.merchants;
drop trigger if exists merchant_locations_enqueue_qr_asset_jobs
  on public.merchant_locations;
drop trigger if exists loyalty_cards_enqueue_qr_asset_jobs on public.loyalty_cards;

drop function if exists public.trigger_enqueue_qr_asset_jobs();
drop function if exists public.trigger_enqueue_qr_asset_jobs_for_merchant();
drop function if exists public.trigger_enqueue_qr_asset_jobs_for_location();
drop function if exists public.trigger_enqueue_qr_asset_jobs_for_card();
drop function if exists public.enqueue_qr_asset_jobs(uuid);
drop function if exists public.enqueue_qr_asset_jobs_for_merchant(uuid);
drop function if exists public.enqueue_qr_asset_jobs_for_location(uuid);
drop function if exists public.enqueue_qr_asset_jobs_for_card(uuid);
drop function if exists public.build_qr_asset_content_version(
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
);
drop function if exists public.record_qr_asset_generated(
  uuid,
  text,
  text,
  text,
  integer
);

drop table if exists public.qr_asset_jobs;

-- Drop the service-role policy only. Supabase blocks direct DELETE on storage.*
-- (protect_delete); any leftover qr-assets bucket/objects are inert orphans.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists qr_assets_service_role_all on storage.objects';
  end if;
end $$;
