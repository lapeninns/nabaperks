-- merchant onboarding continuity
--
-- Make the authoritative merchant, primary venue, and durable onboarding
-- ledger writes one transaction. The migration is safe to replay: duplicate
-- preflights run under table locks only while an invariant is absent, indexes
-- are created conditionally and then verified, and both RPC definitions are
-- replaced in place.

do $onboarding_preflight$
declare
  v_duplicate_count bigint;
begin
  if to_regclass('public.merchants_owner_user_id_key') is null
    or to_regclass('public.product_events_merchant_signed_up_once_idx') is null
    or to_regclass('public.audit_logs_merchant_onboarded_once_idx') is null then
    lock table public.merchants in share row exclusive mode;
    lock table public.product_events in share row exclusive mode;
    lock table public.audit_logs in share row exclusive mode;

    select count(*)
    into v_duplicate_count
    from (
      select merchants.owner_user_id
      from public.merchants
      group by merchants.owner_user_id
      having count(*) > 1
    ) duplicates;

    if v_duplicate_count > 0 then
      raise exception using
        errcode = '23505',
        message = format(
          'Cannot enforce one merchant per owner: %s duplicate owner group(s) exist',
          v_duplicate_count
        ),
        hint = 'Resolve duplicate merchant owners explicitly before replaying this migration.';
    end if;

    select count(*)
    into v_duplicate_count
    from (
      select product_events.merchant_id
      from public.product_events
      where product_events.merchant_id is not null
        and product_events.event_name = 'merchant_signed_up'
      group by product_events.merchant_id
      having count(*) > 1
    ) duplicates;

    if v_duplicate_count > 0 then
      raise exception using
        errcode = '23505',
        message = format(
          'Cannot enforce one merchant_signed_up event per merchant: %s duplicate merchant group(s) exist',
          v_duplicate_count
        ),
        hint = 'Resolve duplicate onboarding product events explicitly before replaying this migration.';
    end if;

    select count(*)
    into v_duplicate_count
    from (
      select audit_logs.merchant_id
      from public.audit_logs
      where audit_logs.merchant_id is not null
        and audit_logs.action = 'merchant_onboarded'
      group by audit_logs.merchant_id
      having count(*) > 1
    ) duplicates;

    if v_duplicate_count > 0 then
      raise exception using
        errcode = '23505',
        message = format(
          'Cannot enforce one merchant_onboarded audit per merchant: %s duplicate merchant group(s) exist',
          v_duplicate_count
        ),
        hint = 'Resolve duplicate onboarding audit rows explicitly before replaying this migration.';
    end if;
  end if;
end;
$onboarding_preflight$;

create unique index if not exists merchants_owner_user_id_key
  on public.merchants (owner_user_id);

create unique index if not exists product_events_merchant_signed_up_once_idx
  on public.product_events (merchant_id)
  where merchant_id is not null
    and event_name = 'merchant_signed_up';

create unique index if not exists audit_logs_merchant_onboarded_once_idx
  on public.audit_logs (merchant_id)
  where merchant_id is not null
    and action = 'merchant_onboarded';

do $onboarding_index_contract$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index indexes
    where indexes.indexrelid = 'public.merchants_owner_user_id_key'::regclass
      and indexes.indrelid = 'public.merchants'::regclass
      and indexes.indisunique
      and indexes.indisvalid
      and indexes.indisready
      and indexes.indnkeyatts = 1
      and pg_catalog.pg_get_indexdef(indexes.indexrelid, 1, false) = 'owner_user_id'
      and indexes.indpred is null
  ) then
    raise exception using
      errcode = '55000',
      message = 'Index merchants_owner_user_id_key exists with an incompatible definition';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index indexes
    where indexes.indexrelid = 'public.product_events_merchant_signed_up_once_idx'::regclass
      and indexes.indrelid = 'public.product_events'::regclass
      and indexes.indisunique
      and indexes.indisvalid
      and indexes.indisready
      and indexes.indnkeyatts = 1
      and pg_catalog.pg_get_indexdef(indexes.indexrelid, 1, false) = 'merchant_id'
      and pg_catalog.pg_get_expr(indexes.indpred, indexes.indrelid)
        = '((merchant_id IS NOT NULL) AND (event_name = ''merchant_signed_up''::text))'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Index product_events_merchant_signed_up_once_idx exists with an incompatible definition';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index indexes
    where indexes.indexrelid = 'public.audit_logs_merchant_onboarded_once_idx'::regclass
      and indexes.indrelid = 'public.audit_logs'::regclass
      and indexes.indisunique
      and indexes.indisvalid
      and indexes.indisready
      and indexes.indnkeyatts = 1
      and pg_catalog.pg_get_indexdef(indexes.indexrelid, 1, false) = 'merchant_id'
      and pg_catalog.pg_get_expr(indexes.indpred, indexes.indrelid)
        = '((merchant_id IS NOT NULL) AND (action = ''merchant_onboarded''::text))'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Index audit_logs_merchant_onboarded_once_idx exists with an incompatible definition';
  end if;
end;
$onboarding_index_contract$;

-- The unique owner index supersedes the original non-unique lookup index.
drop index if exists public.merchants_owner_user_id_idx;

alter table public.merchants enable row level security;
alter table public.merchants force row level security;
alter table public.merchant_locations enable row level security;
alter table public.merchant_locations force row level security;
alter table public.product_events enable row level security;
alter table public.product_events force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

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
  v_auth_email text;
  v_business_name text;
  v_business_type text;
  v_phone text;
  v_location_name text;
  v_address_line_1 text;
  v_address_line_2 text;
  v_address_city text;
  v_address_postcode text;
  v_address_provider text;
  v_address_provider_id text;
  v_address_source text;
  v_geofence_pin_source text;
  v_display_address text;
  v_slug_base text;
  v_readable_slug text;
  v_full_uuid_slug text;
  v_business_slug text;
  v_merchant_id uuid;
  v_location_id uuid;
  v_location_complete boolean := false;
  v_completed_now boolean := true;
  v_completed_at timestamptz;
begin
  v_owner_user_id := (select auth.uid());

  if v_owner_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  -- Both onboarding signatures use this exact transaction lock key. It is
  -- taken before any merchant/location row read or write.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'merchant-onboarding:' || v_owner_user_id::text,
      0
    )
  );

  select lower(btrim(users.email))
  into v_auth_email
  from auth.users
  where users.id = v_owner_user_id;

  if nullif(v_auth_email, '') is null then
    raise invalid_parameter_value using
      message = 'A canonical authenticated email is required';
  end if;

  v_business_name := nullif(btrim(p_business_name), '');
  v_business_type := lower(nullif(btrim(p_business_type), ''));
  v_phone := nullif(btrim(p_phone), '');
  v_location_name := nullif(btrim(p_location_name), '');
  v_address_line_1 := nullif(btrim(p_address_line_1), '');
  v_address_line_2 := nullif(btrim(p_address_line_2), '');
  v_address_city := nullif(btrim(p_address_city), '');
  v_address_postcode := nullif(btrim(p_address_postcode), '');
  v_address_provider := lower(nullif(btrim(p_address_provider), ''));
  v_address_provider_id := nullif(btrim(p_address_provider_id), '');
  v_address_source := lower(nullif(btrim(p_address_source), ''));
  v_geofence_pin_source := lower(nullif(btrim(p_geofence_pin_source), ''));

  if v_business_name is null or char_length(v_business_name) > 120 then
    raise invalid_parameter_value using message = 'Invalid business name';
  end if;

  if v_business_type is null or v_business_type not in (
    'cafe',
    'dessert',
    'bubble_tea',
    'pub',
    'takeaway',
    'barber',
    'salon',
    'other'
  ) then
    raise invalid_parameter_value using message = 'Invalid business type';
  end if;

  if v_phone is not null and char_length(v_phone) > 40 then
    raise invalid_parameter_value using message = 'Invalid phone number';
  end if;

  if v_location_name is null or char_length(v_location_name) > 120 then
    raise invalid_parameter_value using message = 'Invalid location name';
  end if;

  if v_address_line_1 is null or char_length(v_address_line_1) > 120 then
    raise invalid_parameter_value using message = 'Invalid address line 1';
  end if;

  if v_address_line_2 is not null and char_length(v_address_line_2) > 120 then
    raise invalid_parameter_value using message = 'Invalid address line 2';
  end if;

  if v_address_city is null or char_length(v_address_city) > 80 then
    raise invalid_parameter_value using message = 'Invalid address city';
  end if;

  if v_address_postcode is null
    or v_address_postcode <> upper(v_address_postcode)
    or v_address_postcode !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[ ][0-9][A-Z]{2}$' then
    raise invalid_parameter_value using message = 'Invalid canonical UK postcode';
  end if;

  if v_address_source = 'manual_entry' then
    if v_address_provider is not null or v_address_provider_id is not null then
      raise invalid_parameter_value using
        message = 'Manual addresses cannot carry provider identity';
    end if;
  elsif v_address_source = 'provider_lookup' then
    if v_address_provider <> 'google_places'
      or v_address_provider_id is null
      or char_length(v_address_provider_id) > 255 then
      raise invalid_parameter_value using
        message = 'Provider lookup requires a valid Google Places identity';
    end if;
  else
    raise invalid_parameter_value using message = 'Invalid address source';
  end if;

  if p_latitude is null
    or p_latitude::text in ('NaN', 'Infinity', '-Infinity')
    or p_latitude < -90
    or p_latitude > 90 then
    raise invalid_parameter_value using message = 'Invalid latitude';
  end if;

  if p_longitude is null
    or p_longitude::text in ('NaN', 'Infinity', '-Infinity')
    or p_longitude < -180
    or p_longitude > 180 then
    raise invalid_parameter_value using message = 'Invalid longitude';
  end if;

  if p_geofence_radius_meters is null
    or p_geofence_radius_meters < 25
    or p_geofence_radius_meters > 1000 then
    raise invalid_parameter_value using message = 'Invalid geofence radius';
  end if;

  if p_require_geofence is null then
    raise invalid_parameter_value using message = 'Geofence requirement is required';
  end if;

  if p_soft_geofence_trigger_stamp_number is null
    or p_soft_geofence_trigger_stamp_number < 1
    or p_soft_geofence_trigger_stamp_number > 99 then
    raise invalid_parameter_value using
      message = 'Invalid soft geofence trigger stamp';
  end if;

  if v_geofence_pin_source is null
    or v_geofence_pin_source not in ('geocoded', 'merchant_pin') then
    raise invalid_parameter_value using message = 'Invalid geofence pin source';
  end if;

  v_display_address := concat_ws(
    ', ',
    v_address_line_1,
    v_address_line_2,
    v_address_city,
    v_address_postcode
  );

  select merchants.id
  into v_merchant_id
  from public.merchants
  where merchants.owner_user_id = v_owner_user_id
  order by merchants.created_at, merchants.id
  limit 1
  for update;

  if v_merchant_id is not null then
    select
      locations.id,
      (
        locations.is_primary
        and nullif(btrim(locations.name), '') is not null
        and nullif(btrim(locations.address), '') is not null
        and nullif(btrim(locations.address_line_1), '') is not null
        and nullif(btrim(locations.address_city), '') is not null
        and nullif(btrim(locations.address_postcode), '') is not null
        and locations.address_postcode = upper(locations.address_postcode)
        and locations.address_postcode ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[ ][0-9][A-Z]{2}$'
        and locations.address = concat_ws(
          ', ',
          nullif(btrim(locations.address_line_1), ''),
          nullif(btrim(locations.address_line_2), ''),
          nullif(btrim(locations.address_city), ''),
          nullif(btrim(locations.address_postcode), '')
        )
        and locations.address_country = 'GB'
        and locations.address_source in ('manual_entry', 'provider_lookup')
        and (
          (
            locations.address_source = 'manual_entry'
            and locations.address_provider is null
            and locations.address_provider_id is null
          )
          or (
            locations.address_source = 'provider_lookup'
            and locations.address_provider = 'google_places'
            and nullif(btrim(locations.address_provider_id), '') is not null
          )
        )
        and locations.latitude is not null
        and locations.latitude::text not in ('NaN', 'Infinity', '-Infinity')
        and locations.latitude between -90 and 90
        and locations.longitude is not null
        and locations.longitude::text not in ('NaN', 'Infinity', '-Infinity')
        and locations.longitude between -180 and 180
        and locations.geofence_radius_meters between 25 and 1000
        and locations.soft_geofence_trigger_stamp_number between 1 and 99
        and locations.geocoded_at is not null
        and locations.geofence_pin_source in ('geocoded', 'merchant_pin')
        and locations.geofence_pin_updated_at is not null
      )
    into v_location_id, v_location_complete
    from public.merchant_locations locations
    where locations.merchant_id = v_merchant_id
    order by locations.is_primary desc, locations.created_at, locations.id
    limit 1
    for update;

    if coalesce(v_location_complete, false) then
      -- First complete write wins, but historical/directly repaired rows can
      -- still be missing the durable onboarding ledger. Continue to the
      -- conflict-safe ledger inserts without rewriting profile or venue data.
      v_completed_now := false;
    else
      v_completed_at := statement_timestamp();

      update public.merchants
      set business_name = v_business_name,
          business_type = v_business_type,
          email = v_auth_email,
          phone = v_phone,
          updated_at = v_completed_at
      where merchants.id = v_merchant_id;
    end if;
  else
    v_slug_base := left(
      trim(
        both '-' from regexp_replace(
          regexp_replace(
            lower(v_business_name),
            '&',
            ' and ',
            'g'
          ),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      48
    );

    if nullif(v_slug_base, '') is null then
      v_slug_base := 'merchant';
    end if;

    v_readable_slug := v_slug_base || '-' || left(v_owner_user_id::text, 8);
    v_full_uuid_slug := v_slug_base || '-' || v_owner_user_id::text;
    v_business_slug := v_readable_slug;

    if exists (
      select 1
      from public.merchants
      where merchants.business_slug = v_readable_slug
    ) then
      v_business_slug := v_full_uuid_slug;
    end if;

    v_completed_at := statement_timestamp();

    begin
      insert into public.merchants (
        owner_user_id,
        business_name,
        business_slug,
        business_type,
        email,
        phone,
        status,
        requires_billing,
        updated_at
      )
      values (
        v_owner_user_id,
        v_business_name,
        v_business_slug,
        v_business_type,
        v_auth_email,
        v_phone,
        'trial',
        true,
        v_completed_at
      )
      returning id into v_merchant_id;
    exception
      when unique_violation then
        if v_business_slug <> v_readable_slug then
          raise;
        end if;

        v_business_slug := v_full_uuid_slug;

        insert into public.merchants (
          owner_user_id,
          business_name,
          business_slug,
          business_type,
          email,
          phone,
          status,
          requires_billing,
          updated_at
        )
        values (
          v_owner_user_id,
          v_business_name,
          v_business_slug,
          v_business_type,
          v_auth_email,
          v_phone,
          'trial',
          true,
          v_completed_at
        )
        returning id into v_merchant_id;
    end;
  end if;

  if v_completed_now then
    if v_location_id is null then
      insert into public.merchant_locations (
        merchant_id,
        name,
        address,
        is_primary,
        updated_at,
        latitude,
        longitude,
        geofence_radius_meters,
        require_geofence,
        geocoded_at,
        address_line_1,
        address_line_2,
        address_city,
        address_postcode,
        address_country,
        address_provider,
        address_provider_id,
        address_source,
        soft_geofence_trigger_stamp_number,
        geofence_pin_source,
        geofence_pin_updated_at
      )
      values (
        v_merchant_id,
        v_location_name,
        v_display_address,
        true,
        v_completed_at,
        p_latitude,
        p_longitude,
        p_geofence_radius_meters,
        p_require_geofence,
        v_completed_at,
        v_address_line_1,
        v_address_line_2,
        v_address_city,
        v_address_postcode,
        'GB',
        v_address_provider,
        v_address_provider_id,
        v_address_source,
        p_soft_geofence_trigger_stamp_number,
        v_geofence_pin_source,
        v_completed_at
      )
      returning id into v_location_id;
    else
      update public.merchant_locations
      set name = v_location_name,
          address = v_display_address,
          is_primary = true,
          updated_at = v_completed_at,
          latitude = p_latitude,
          longitude = p_longitude,
          geofence_radius_meters = p_geofence_radius_meters,
          require_geofence = p_require_geofence,
          geocoded_at = v_completed_at,
          address_line_1 = v_address_line_1,
          address_line_2 = v_address_line_2,
          address_city = v_address_city,
          address_postcode = v_address_postcode,
          address_country = 'GB',
          address_provider = v_address_provider,
          address_provider_id = v_address_provider_id,
          address_source = v_address_source,
          soft_geofence_trigger_stamp_number = p_soft_geofence_trigger_stamp_number,
          geofence_pin_source = v_geofence_pin_source,
          geofence_pin_updated_at = v_completed_at
      where merchant_locations.id = v_location_id;
    end if;
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'merchant_signed_up',
    v_merchant_id,
    'merchant',
    v_owner_user_id::text,
    jsonb_build_object('source', 'onboarding')
  )
  on conflict (merchant_id)
    where merchant_id is not null
      and event_name = 'merchant_signed_up'
    do nothing;

  -- Deliberately last: a failure here rolls back merchant, location, and event.
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
    v_merchant_id,
    'merchants',
    v_merchant_id,
    'merchant_onboarded',
    jsonb_build_object('location_id', v_location_id)
  )
  on conflict (merchant_id)
    where merchant_id is not null
      and action = 'merchant_onboarded'
    do nothing;

  merchant_id := v_merchant_id;
  location_id := v_location_id;
  completed_now := v_completed_now;
  return next;
end;
$function$;

-- Deployment compatibility only. The application no longer calls this
-- signature, but an older server instance may overlap the migration rollout.
-- It shares the atomic RPC's owner lock and unique ledger invariants.
create or replace function public.create_merchant_onboarding(
  p_owner_user_id uuid,
  p_email text,
  p_business_name text,
  p_business_slug text,
  p_business_type text,
  p_phone text,
  p_location_name text
)
returns table (
  merchant_id uuid,
  location_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $function$
#variable_conflict use_column
declare
  v_owner_user_id uuid;
  v_auth_email text;
  v_business_name text;
  v_business_slug text;
  v_business_type text;
  v_phone text;
  v_location_name text;
  v_merchant_id uuid;
  v_location_id uuid;
begin
  v_owner_user_id := (select auth.uid());

  if v_owner_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_owner_user_id is null
    or p_owner_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Owner user mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'merchant-onboarding:' || v_owner_user_id::text,
      0
    )
  );

  select lower(btrim(users.email))
  into v_auth_email
  from auth.users
  where users.id = v_owner_user_id;

  if nullif(v_auth_email, '') is null then
    raise invalid_parameter_value using
      message = 'A canonical authenticated email is required';
  end if;

  -- p_email remains in the deployment-compatible signature but identity is
  -- canonicalized from auth.users rather than trusted from the caller.
  perform p_email;

  v_business_name := nullif(btrim(p_business_name), '');
  v_business_slug := nullif(btrim(p_business_slug), '');
  v_business_type := lower(nullif(btrim(p_business_type), ''));
  v_phone := nullif(btrim(p_phone), '');
  v_location_name := nullif(btrim(p_location_name), '');

  if v_business_name is null or char_length(v_business_name) > 120 then
    raise invalid_parameter_value using message = 'Invalid business name';
  end if;

  if v_business_slug is null or char_length(v_business_slug) > 128 then
    raise invalid_parameter_value using message = 'Invalid business slug';
  end if;

  if v_business_type is null or v_business_type not in (
    'cafe',
    'dessert',
    'bubble_tea',
    'pub',
    'takeaway',
    'barber',
    'salon',
    'other'
  ) then
    raise invalid_parameter_value using message = 'Invalid business type';
  end if;

  if v_phone is not null and char_length(v_phone) > 40 then
    raise invalid_parameter_value using message = 'Invalid phone number';
  end if;

  if v_location_name is null or char_length(v_location_name) > 120 then
    raise invalid_parameter_value using message = 'Invalid location name';
  end if;

  select merchants.id
  into v_merchant_id
  from public.merchants
  where merchants.owner_user_id = v_owner_user_id
  order by merchants.created_at, merchants.id
  limit 1
  for update;

  if v_merchant_id is null then
    insert into public.merchants (
      owner_user_id,
      business_name,
      business_slug,
      business_type,
      email,
      phone,
      status,
      requires_billing
    )
    values (
      v_owner_user_id,
      v_business_name,
      v_business_slug,
      v_business_type,
      v_auth_email,
      v_phone,
      'trial',
      true
    )
    returning id into v_merchant_id;
  end if;

  select locations.id
  into v_location_id
  from public.merchant_locations locations
  where locations.merchant_id = v_merchant_id
  order by locations.is_primary desc, locations.created_at, locations.id
  limit 1
  for update;

  if v_location_id is null then
    insert into public.merchant_locations (
      merchant_id,
      name,
      is_primary
    )
    values (
      v_merchant_id,
      v_location_name,
      true
    )
    returning id into v_location_id;
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'merchant_signed_up',
    v_merchant_id,
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
    v_merchant_id,
    'merchants',
    v_merchant_id,
    'merchant_onboarded',
    jsonb_build_object('location_id', v_location_id)
  )
  on conflict (merchant_id)
    where merchant_id is not null
      and action = 'merchant_onboarded'
    do nothing;

  merchant_id := v_merchant_id;
  location_id := v_location_id;
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
) from public;
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
) from anon, authenticated, service_role;
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

revoke all on function public.create_merchant_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.create_merchant_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) from anon, authenticated, service_role;
grant execute on function public.create_merchant_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated, service_role;

notify pgrst, 'reload schema';
