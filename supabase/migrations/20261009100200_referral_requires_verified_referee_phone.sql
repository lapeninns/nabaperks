-- QA BUG-004 (38c42a1..2c45031): email-only wallets (CUSTOMER_EMAIL_AUTH_MODE
-- full) removed the per-referee cost the referral controls relied on, so every
-- plus-alias of one inbox qualified as a new member and paid its referrer bonus
-- stamps. Owner decision (Q1): a referral qualifies only while the referee
-- wallet holds a verified phone (phone_hmac and phone_verified_at both set),
-- mirroring the phone-only offer campaigns.
--
-- The edge is not rejected: it stays 'attributed'. Every earned stamp calls
-- this function again (award_referrer_bonus_stamp, settle_referral_bonus), so
-- once the referee verifies a phone their next earned stamp qualifies the edge
-- from their earliest qualifying visit. Verifying a phone alone does not
-- qualify it. Otherwise the body is the 20260922100000 definition; signature,
-- owner, SECURITY DEFINER, search_path and the service-role grant are
-- unchanged.

create or replace function public.qualify_referral_on_stamp(
  p_membership_id uuid,
  p_stamp_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_edge record;
  v_membership record;
  v_qualifying_stamp uuid;
begin
  select customer_id, merchant_id
  into v_membership
  from public.customer_memberships
  where id = p_membership_id;

  if v_membership.customer_id is null then
    return;
  end if;

  -- A referee without a verified phone is not yet a distinct new member: keep
  -- the edge attributed until a later earned stamp after phone verification.
  if not exists (
    select 1
    from public.customers c
    where c.id = v_membership.customer_id
      and c.phone_hmac is not null
      and c.phone_verified_at is not null
  ) then
    return;
  end if;

  select r.id, r.venue_id, r.referrer_customer_id, r.referrer_membership_id
  into v_edge
  from public.referrals r
  where r.status = 'attributed'
    and (
      r.referred_membership_id = p_membership_id
      or (
        r.referred_customer_id = v_membership.customer_id
        and r.venue_id = v_membership.merchant_id
      )
    )
  for update of r;

  if v_edge.id is null then
    return;
  end if;

  perform public.relink_referral_memberships(v_edge.id);

  select se.id
  into v_qualifying_stamp
  from public.stamp_events se
  where se.membership_id = p_membership_id
    and se.event_type = 'earned'
    and coalesce(se.metadata->>'source', '') not in (
      'referral_bonus', 'imported', 'manual_adjustment', 'loyalty_invite',
      'offer_campaign'
    )
  order by
    case when se.id = p_stamp_event_id then 0 else 1 end,
    se.created_at asc,
    se.id asc
  limit 1;

  if v_qualifying_stamp is null then
    return;
  end if;

  update public.referrals
  set status = 'qualified',
      qualified_at = now(),
      qualifying_stamp_id = v_qualifying_stamp,
      referred_membership_id = p_membership_id
  where id = v_edge.id;

  -- The fraud trigger has run by the time this statement returns. Product and
  -- notification events describe qualification even when settlement is paused.
  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'referral_qualified', v_edge.venue_id, v_edge.referrer_customer_id,
    v_edge.referrer_membership_id, 'system', null,
    jsonb_build_object('referral_edge_id', v_edge.id,
      'qualifying_stamp_id', v_qualifying_stamp,
      'referred_membership_id', p_membership_id)
  );

  if v_edge.referrer_customer_id is not null and v_edge.referrer_membership_id is not null then
    begin
      perform public.enqueue_notification_event(
        p_event_type := 'referral_qualified',
        p_customer_id := v_edge.referrer_customer_id,
        p_merchant_id := v_edge.venue_id,
        p_membership_id := v_edge.referrer_membership_id,
        p_dedupe_key := 'referral:' || v_edge.id::text || ':qualified',
        p_payload := jsonb_build_object(
          'title', 'Your referral qualified',
          'body', 'Your invited friend made their first visit to ' || coalesce((select nullif(trim(business_name), '') from public.merchants where id = v_edge.venue_id), 'Your venue') || ' — your bonus is on its way.',
          'url', '/card/' || v_edge.referrer_membership_id::text),
        p_metadata := jsonb_build_object('referral_edge_id', v_edge.id)
      );
    exception
      when others then
        raise warning 'referral qualified notification skipped for %: %', v_edge.id, sqlerrm;
    end;
  end if;
end;
$function$;

revoke all on function public.qualify_referral_on_stamp(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.qualify_referral_on_stamp(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
