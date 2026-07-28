-- Keep manual merchant onboarding available when the optional geocoding
-- provider is unavailable. The public RPC signature and executor allowlist stay
-- unchanged; the previously applied implementation is retained as a private,
-- non-executable helper for the resolved-coordinate path.

alter table public.merchant_locations
  drop constraint if exists merchant_locations_geofence_pin_source_check;

alter table public.merchant_locations
  add constraint merchant_locations_geofence_pin_source_check
  check (geofence_pin_source in ('geocoded', 'merchant_pin', 'unresolved'));

do $migration$
begin
  if to_regprocedure(
    'public.complete_merchant_onboarding_resolved(text,text,text,text,text,text,text,text,text,text,text,double precision,double precision,integer,boolean,integer,text)'
  ) is null then
    alter function public.complete_merchant_onboarding(
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      double precision,
      double precision,
      integer,
      boolean,
      integer,
      text
    ) rename to complete_merchant_onboarding_resolved;
  end if;
end
$migration$;

revoke all on function public.complete_merchant_onboarding_resolved(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  integer,
  boolean,
  integer,
  text
) from public, anon, authenticated, service_role;

create or replace function public.complete_merchant_onboarding(
  p_business_name text,
  p_business_type text,
  p_phone text,
  p_location_name text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_address_city text,
  p_address_postcode text,
  p_address_provider text,
  p_address_provider_id text,
  p_address_source text,
  p_latitude double precision,
  p_longitude double precision,
  p_geofence_radius_meters integer,
  p_require_geofence boolean,
  p_soft_geofence_trigger_stamp_number integer,
  p_geofence_pin_source text
)
returns table (
  merchant_id uuid,
  location_id uuid,
  completed_now boolean
)
language plpgsql
security definer
set search_path = public, auth
as $function$
#variable_conflict use_column
declare
  v_owner_user_id uuid;
  v_existing_merchant_id uuid;
  v_existing_location_id uuid;
  v_result record;
  v_unresolved boolean;
begin
  v_owner_user_id := (select auth.uid());

  if v_owner_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'merchant-onboarding:' || v_owner_user_id::text,
      0
    )
  );

  if (p_latitude is null) <> (p_longitude is null) then
    raise invalid_parameter_value using
      message = 'Latitude and longitude must both be present or absent';
  end if;

  v_unresolved := p_latitude is null and p_longitude is null;

  if v_unresolved and (
    p_require_geofence is distinct from false
    or lower(nullif(btrim(p_address_source), '')) <> 'manual_entry'
    or nullif(btrim(p_address_provider), '') is not null
    or nullif(btrim(p_address_provider_id), '') is not null
    or lower(nullif(btrim(p_geofence_pin_source), '')) <> 'unresolved'
  ) then
    raise invalid_parameter_value using
      message = 'Unresolved coordinates require manual address mode with geofence disabled';
  end if;

  if not v_unresolved
    and lower(nullif(btrim(p_geofence_pin_source), '')) = 'unresolved' then
    raise invalid_parameter_value using
      message = 'Resolved coordinates require a resolved pin source';
  end if;

  -- An unresolved venue produced by this wrapper is a complete first write.
  -- Preserve the original first-write-wins contract on every later retry,
  -- including a retry that now has provider coordinates.
  select merchants.id
  into v_existing_merchant_id
  from public.merchants merchants
  where merchants.owner_user_id = v_owner_user_id
  order by merchants.created_at, merchants.id
  limit 1
  for update;

  if v_existing_merchant_id is not null then
    select locations.id
    into v_existing_location_id
    from public.merchant_locations locations
    where locations.merchant_id = v_existing_merchant_id
      and locations.is_primary
      and nullif(btrim(locations.name), '') is not null
      and nullif(btrim(locations.address), '') is not null
      and nullif(btrim(locations.address_line_1), '') is not null
      and nullif(btrim(locations.address_city), '') is not null
      and nullif(btrim(locations.address_postcode), '') is not null
      and locations.address_postcode = upper(locations.address_postcode)
      and locations.address_postcode
        ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[ ][0-9][A-Z]{2}$'
      and locations.address = concat_ws(
        ', ',
        nullif(btrim(locations.address_line_1), ''),
        nullif(btrim(locations.address_line_2), ''),
        nullif(btrim(locations.address_city), ''),
        nullif(btrim(locations.address_postcode), '')
      )
      and locations.address_country = 'GB'
      and locations.address_source = 'manual_entry'
      and locations.address_provider is null
      and locations.address_provider_id is null
      and locations.latitude is null
      and locations.longitude is null
      and not locations.require_geofence
      and locations.geofence_radius_meters between 25 and 1000
      and locations.soft_geofence_trigger_stamp_number between 1 and 99
      and locations.geocoded_at is null
      and locations.geofence_pin_source = 'unresolved'
      and locations.geofence_pin_updated_at is null
    order by locations.created_at, locations.id
    limit 1
    for update;
  end if;

  if v_existing_location_id is not null then
    insert into public.product_events (
      event_name,
      merchant_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'merchant_signed_up',
      v_existing_merchant_id,
      'merchant',
      v_owner_user_id::text,
      jsonb_build_object('source', 'onboarding')
    )
    on conflict (merchant_id)
      where merchant_id is not null
        and event_name = 'merchant_signed_up'
      do nothing;

    insert into public.audit_logs (
      actor_type,
      actor_id,
      merchant_id,
      target_table,
      target_id,
      action,
      metadata
    )
    values (
      'merchant',
      v_owner_user_id::text,
      v_existing_merchant_id,
      'merchants',
      v_existing_merchant_id,
      'merchant_onboarded',
      jsonb_build_object('location_id', v_existing_location_id)
    )
    on conflict (merchant_id)
      where merchant_id is not null
        and action = 'merchant_onboarded'
      do nothing;

    merchant_id := v_existing_merchant_id;
    location_id := v_existing_location_id;
    completed_now := false;
    return next;
    return;
  end if;

  select *
  into v_result
  from public.complete_merchant_onboarding_resolved(
    p_business_name,
    p_business_type,
    p_phone,
    p_location_name,
    p_address_line_1,
    p_address_line_2,
    p_address_city,
    p_address_postcode,
    p_address_provider,
    p_address_provider_id,
    p_address_source,
    case when v_unresolved then 0::double precision else p_latitude end,
    case when v_unresolved then 0::double precision else p_longitude end,
    p_geofence_radius_meters,
    p_require_geofence,
    p_soft_geofence_trigger_stamp_number,
    case when v_unresolved then 'geocoded' else p_geofence_pin_source end
  );

  if v_unresolved and v_result.completed_now then
    update public.merchant_locations
    set latitude = null,
        longitude = null,
        geocoded_at = null,
        geofence_pin_source = 'unresolved',
        geofence_pin_updated_at = null
    where merchant_locations.id = v_result.location_id;
  end if;

  merchant_id := v_result.merchant_id;
  location_id := v_result.location_id;
  completed_now := v_result.completed_now;
  return next;
end;
$function$;

revoke all on function public.complete_merchant_onboarding(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  integer,
  boolean,
  integer,
  text
) from public, anon;

grant execute on function public.complete_merchant_onboarding(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  integer,
  boolean,
  integer,
  text
) to authenticated, service_role;

notify pgrst, 'reload schema';
