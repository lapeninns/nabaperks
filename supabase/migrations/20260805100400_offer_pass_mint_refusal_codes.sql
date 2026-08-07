-- Merchant Offers and Campaign QR — refusal codes for the pass mint path.
--
-- The Offers pass flow is asymmetric. get_offer_pass_scan_context returns a
-- clean status enum ('ready' | 'redeemed' | 'blocked' | 'expired' |
-- 'unauthorized' | 'not_found'), but create_offer_pass_scan_token — the customer
-- side, the one that decides whether a pass can present a code at all —
-- communicates the same conditions with prose:
--
--   raise exception 'This pass is no longer active';
--   raise exception 'This pass is outside its valid dates';
--   raise exception 'This loyalty programme is unavailable right now';
--
-- so the customer surface must either string-match those or fall back to a
-- generic error. That is the same brittleness 20260805100100 removed from the
-- stamping path, and it is fixed the same way: stable SQLSTATEs, in the same NBS
-- family, continuing the numbering.
--
--   NBP01  pass is not active (revoked, expired, already retired)
--   NBP02  pass is outside its own valid_from/valid_to window
--   NBP03  the venue's loyalty programme is unavailable (status or billing)
--
-- Ownership and existence keep insufficient_privilege (42501), unchanged and
-- already stable.
--
-- Nothing else moves: the same purge, the same reuse window, the same row lock,
-- the same ACL. This is the previous body with three raises given codes.
--
-- Forward-only and re-runnable.

create or replace function public.create_offer_pass_scan_token(
  p_entitlement_id uuid,
  p_customer_id uuid
)
returns table (
  scan_token uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_pass record;
  v_reusable record;
  v_today date := public.uk_business_date(now());
  v_availability text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.purge_expired_offer_pass_scan_tokens(now());

  select
    e.id,
    e.customer_id,
    e.merchant_id,
    e.membership_id,
    e.status,
    e.valid_from,
    e.valid_to,
    m.status as merchant_status,
    m.requires_billing,
    bc.status as billing_status,
    exists (
      select 1 from public.loyalty_cards lc
      where lc.merchant_id = e.merchant_id and lc.is_active
    ) as card_active
  into v_pass
  from public.offer_discount_entitlements e
  join public.merchants m on m.id = e.merchant_id
  left join public.billing_customers bc on bc.merchant_id = e.merchant_id
  where e.id = p_entitlement_id
  for update of e;

  if v_pass.id is null then
    raise insufficient_privilege using message = 'Offer pass not found';
  end if;

  if v_pass.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Offer pass ownership required';
  end if;

  if v_pass.status <> 'active' then
    raise exception 'This pass is no longer active' using errcode = 'NBP01';
  end if;

  if v_today < v_pass.valid_from or v_today > v_pass.valid_to then
    raise exception 'This pass is outside its valid dates' using errcode = 'NBP02';
  end if;

  v_availability := public.loyalty_availability_reason(
    v_pass.merchant_status,
    v_pass.card_active,
    v_pass.billing_status,
    v_pass.requires_billing
  );

  if v_availability is not null then
    raise exception 'This loyalty programme is unavailable right now'
      using errcode = 'NBP03';
  end if;

  select t.id, t.expires_at
  into v_reusable
  from public.offer_pass_scan_tokens t
  where t.entitlement_id = v_pass.id
    and t.customer_id = v_pass.customer_id
    and t.consumed_at is null
    and t.expires_at > now() + interval '5 minutes'
  order by t.expires_at desc
  limit 1;

  if v_reusable.id is not null then
    scan_token := v_reusable.id;
    expires_at := v_reusable.expires_at;
    return next;
    return;
  end if;

  insert into public.offer_pass_scan_tokens (
    entitlement_id,
    merchant_id,
    customer_id,
    membership_id
  )
  values (
    v_pass.id,
    v_pass.merchant_id,
    v_pass.customer_id,
    v_pass.membership_id
  )
  returning id, offer_pass_scan_tokens.expires_at
  into scan_token, expires_at;

  return next;
end;
$function$;

comment on function public.create_offer_pass_scan_token(uuid, uuid) is
  'Mints a short-lived scan token for a discount pass. Refusals carry stable SQLSTATEs (NBP01 inactive, NBP02 outside window, NBP03 programme unavailable) so the customer surface never string-matches prose.';

revoke all on function public.create_offer_pass_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_offer_pass_scan_token(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
