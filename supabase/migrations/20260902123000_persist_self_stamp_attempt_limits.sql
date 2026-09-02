-- A rejected stamp rolls its transaction back, including the legacy limiter
-- charge inside issue_self_service_stamp. Charge an application attempt in its
-- own committed RPC before any referral or stamp side effect instead.

create or replace function public.consume_self_service_stamp_attempt(
  p_membership_id uuid,
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_owner_id uuid;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  if p_membership_id is null or p_customer_id is null then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  select customer_memberships.customer_id
  into v_owner_id
  from public.customer_memberships
  where customer_memberships.id = p_membership_id;

  if v_owner_id is null or v_owner_id <> p_customer_id then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  perform public.enforce_rate_limit(
    'selfstamp-attempt:' || p_membership_id::text,
    10,
    900000
  );
end;
$function$;

revoke all on function public.consume_self_service_stamp_attempt(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.consume_self_service_stamp_attempt(uuid, uuid)
  to service_role;

-- Keep one refusal signal per membership/reason/window and increment its count.
-- The advisory lock makes the read/update-or-insert decision concurrency safe.
create or replace function public.record_stamp_location_refusal(
  p_membership_id uuid,
  p_customer_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_membership record;
  v_signal text;
  v_existing_flag record;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  if p_membership_id is null or p_customer_id is null then
    return;
  end if;

  v_signal := case p_reason
    when 'location_out_of_range' then 'self_service_geofence_out_of_range'
    when 'location_required' then 'self_service_geofence_unverified'
    else null
  end;

  if v_signal is null then
    return;
  end if;

  select memberships.id, memberships.merchant_id, memberships.customer_id
  into v_membership
  from public.customer_memberships memberships
  where memberships.id = p_membership_id;

  if v_membership.id is null or v_membership.customer_id <> p_customer_id then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'stamp-refusal:' || p_membership_id::text || ':' || v_signal,
      0
    )
  );

  select fraud_flags.id, fraud_flags.metadata
  into v_existing_flag
  from public.fraud_flags
  where fraud_flags.membership_id = p_membership_id
    and fraud_flags.customer_id = p_customer_id
    and fraud_flags.signal = v_signal
    and fraud_flags.created_at > clock_timestamp() - interval '15 minutes'
  order by fraud_flags.created_at desc
  limit 1
  for update;

  if v_existing_flag.id is not null then
    update public.fraud_flags
    set metadata = coalesce(v_existing_flag.metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'attempt_count',
        case
          when coalesce(v_existing_flag.metadata->>'attempt_count', '') ~ '^[0-9]+$'
            then (v_existing_flag.metadata->>'attempt_count')::integer + 1
          else 2
        end,
        'last_attempt_at', clock_timestamp()
      )
    where fraud_flags.id = v_existing_flag.id;
    return;
  end if;

  insert into public.fraud_flags (
    merchant_id, customer_id, membership_id, signal, severity, metadata
  ) values (
    v_membership.merchant_id, v_membership.customer_id, p_membership_id,
    v_signal, 'low',
    jsonb_build_object(
      'source', 'self_service_qr',
      'refused', true,
      'attempt_count', 1,
      'last_attempt_at', clock_timestamp()
    )
  );

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id,
    actor_type, actor_id, metadata
  ) values (
    'stamp_refused_location', v_membership.merchant_id, v_membership.customer_id,
    p_membership_id, 'customer', p_customer_id::text,
    jsonb_build_object(
      'outcome', 'blocked',
      'reason', p_reason,
      'aggregated_window_minutes', 15
    )
  );
end;
$function$;

revoke all on function public.record_stamp_location_refusal(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_stamp_location_refusal(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
