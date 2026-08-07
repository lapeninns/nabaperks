-- Loyalty integrity — record a location refusal where it can actually survive.
--
-- 20260805100100 made an out-of-range stamp REFUSE rather than land-and-flag.
-- That is the behaviour we want, but it silently cost us the signal: the branch
-- called record_cycle_stamp_soft_geofence_flag and then raised, and the raise
-- aborts the transaction, so the fraud_flags row was rolled back with it. Proven
-- against the live database — the refusal returned NBS10 and left zero flags.
--
-- A refusal that leaves no evidence is worse than the soft flag it replaced:
-- out-of-range is precisely the case a venue should be able to see.
--
-- The fix is the same shape as the referral ledger in 20260805100300 — record
-- from a transaction that commits. Here that means the CALLER records, after the
-- RPC has already failed, through this function.
--
-- Two rows, both cheap and both queryable:
--   fraud_flags     the venue-facing signal, preserving the signal names the
--                   soft-geofence path already used so existing readers work.
--   product_events  the analytics ledger, with outcome 'blocked' so it can be
--                   mirrored to PostHog without widening the allowlist.
--
-- Ownership is verified here rather than trusted: this is reachable from the
-- service-role client, so it must not let one customer write a flag against
-- another's membership.
--
-- Deliberately NOT deduplicated. A customer repeatedly trying to stamp from
-- outside the venue is the pattern worth seeing, so each refusal is its own row;
-- the existing 15-minute open-flag window in the stamping path is what keeps
-- ordinary velocity noise down, and this signal is separate from that.
--
-- Forward-only and re-runnable.

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
begin
  if p_membership_id is null or p_customer_id is null then
    return;
  end if;

  v_signal := case p_reason
    when 'location_out_of_range' then 'self_service_geofence_out_of_range'
    when 'location_required' then 'self_service_geofence_unverified'
    else null
  end;

  -- An unknown reason is not an error worth raising into a customer's failed
  -- stamp; it simply is not a location refusal.
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

  insert into public.fraud_flags (
    merchant_id, customer_id, membership_id, signal, severity, metadata
  ) values (
    v_membership.merchant_id, v_membership.customer_id, p_membership_id,
    v_signal, 'low',
    jsonb_build_object('source', 'self_service_qr', 'refused', true)
  );

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id,
    actor_type, actor_id, metadata
  ) values (
    'stamp_refused_location', v_membership.merchant_id, v_membership.customer_id,
    p_membership_id, 'customer', p_customer_id::text,
    jsonb_build_object('outcome', 'blocked', 'reason', p_reason)
  );
end;
$function$;

comment on function public.record_stamp_location_refusal(uuid, uuid, text) is
  'Records a location-refused stamp attempt. Called by the caller AFTER the stamp RPC has raised NBS10/NBS11, because a row written inside the refusing transaction is rolled back with it.';

revoke all on function public.record_stamp_location_refusal(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_stamp_location_refusal(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
