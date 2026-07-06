-- MS-merchant-soft-geofence-knob: the soft-geofence trigger stamp becomes a
-- real per-location merchant setting (owner decision 2026-07-06 — make the
-- knob real rather than drop the constant column).
--
-- Before: CHECK (soft_geofence_trigger_stamp_number = 3) — a constant in
-- disguise; the stamping RPC reads it via coalesce(value, 3), so every venue
-- soft-checked location on cycle stamp 3. After: the CHECK allows 1–99
-- (mirroring stamps_required bounds), default stays 3, existing rows are
-- untouched, and merchants set the value from the venue settings surface.
--
-- record_cycle_stamp_soft_geofence_flag is recreated (OR REPLACE, shape
-- unchanged, grants survive) because its fraud-flag metadata hardcoded
-- reason 'cycle_stamp_3_soft_geofence' — stale the moment the knob varies;
-- the reason now carries the actual configured stamp number.
--
-- Idempotent: guarded constraint swap; OR REPLACE re-runs harmlessly.

alter table public.merchant_locations
  drop constraint if exists merchant_locations_soft_geofence_trigger_stamp_number_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'merchant_locations_soft_geofence_trigger_range_check'
  ) then
    alter table public.merchant_locations
      add constraint merchant_locations_soft_geofence_trigger_range_check
      check (soft_geofence_trigger_stamp_number between 1 and 99);
  end if;
end
$$;

CREATE OR REPLACE FUNCTION public.record_cycle_stamp_soft_geofence_flag(p_merchant_id uuid, p_customer_id uuid, p_membership_id uuid, p_location_id uuid, p_cycle_stamp_number integer, p_location_status text, p_distance_bucket text, p_accuracy_bucket text, p_confidence text, p_configured_radius_meters integer, p_effective_radius_meters integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.fraud_flags (
    merchant_id,
    customer_id,
    membership_id,
    signal,
    severity,
    metadata
  )
  values (
    p_merchant_id,
    p_customer_id,
    p_membership_id,
    'self_service_geofence_out_of_range',
    'medium',
    jsonb_build_object(
      'context', 'stamp',
      'location_id', p_location_id,
      'cycle_stamp_number', p_cycle_stamp_number,
      'location_status', p_location_status,
      'distance_bucket', p_distance_bucket,
      'accuracy_bucket', p_accuracy_bucket,
      'confidence', p_confidence,
      'configured_radius_meters', p_configured_radius_meters,
      'effective_radius_meters', p_effective_radius_meters,
      'accuracy_cap_meters', 100,
      'fixed_tolerance_meters', 10,
      'reason', 'cycle_stamp_' || p_cycle_stamp_number || '_soft_geofence'
    )
  );
end;
$function$

;
