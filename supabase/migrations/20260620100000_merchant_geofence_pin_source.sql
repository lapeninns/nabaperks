-- Separate venue-pin provenance from address provenance. geofence_pin_source
-- records whether the stored venue coordinates came from the address geocode or
-- from a manual merchant pin drop, so the address provenance column is never
-- overloaded with coordinate provenance.

alter table public.merchant_locations
  add column if not exists geofence_pin_source text not null default 'geocoded';

alter table public.merchant_locations
  add column if not exists geofence_pin_updated_at timestamptz;

alter table public.merchant_locations
  drop constraint if exists merchant_locations_geofence_pin_source_check;

alter table public.merchant_locations
  add constraint merchant_locations_geofence_pin_source_check
  check (geofence_pin_source in ('geocoded', 'merchant_pin'));

-- Existing rows are geocoded (the not-null default covers them); carry the
-- geocode timestamp onto the new pin timestamp where one exists, without
-- clobbering rows already stamped by a manual pin.
update public.merchant_locations
set geofence_pin_source = 'geocoded'
where geofence_pin_source is null;

update public.merchant_locations
set geofence_pin_updated_at = geocoded_at
where geofence_pin_updated_at is null
  and geocoded_at is not null;
