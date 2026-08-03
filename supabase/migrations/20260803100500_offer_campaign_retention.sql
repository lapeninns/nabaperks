-- Merchant Offers and Campaign QR — retention, erasure and export.
--
-- Three functions live here:
--   expire_and_purge_offer_campaigns     the privacy-retention cron sweep
--   admin_erase_offer_claims_for_customer   GDPR erasure companion
--   offer_claims_export_for_customer        GDPR subject-access companion
--
-- The sweep has two jobs. It ACTIVATES campaigns whose start date has arrived,
-- so the merchant desk reads 'live' without waiting for a customer to scan; and
-- it RETIRES what is past its window — campaigns beyond ends_on, passes beyond
-- valid_to, and dead scan tokens. The claim path flips a due 'scheduled' row
-- under its own row lock as well; that belt-and-braces duplication is
-- deliberate, because correctness must not depend on cron liveness.
--
-- The rules this file exists to hold, each of them a product rule:
--
--   * Ending or expiring a CAMPAIGN never cancels a PASS already issued. The
--     entitlement carries its own snapshotted window and its own status, and it
--     stays redeemable until valid_to whatever the campaign does. A retention
--     sweep that revoked live entitlements would break a promise already made,
--     so nothing below joins campaign state to entitlement state.
--
--   * Benefit values are snapshotted on the claim and on the entitlement so
--     later campaign state cannot rewrite issued terms. Retention preserves
--     that: it only ever moves a status or removes ephemeral bearer material,
--     and never rewrites discount_percent, requires_id_check, extra_terms or a
--     validity window.
--
--   * offer_redemptions is append-only, enforced by the
--     offer_redemptions_append_only trigger from 20260803100000 and by an ACL
--     that grants service_role SELECT and INSERT only. Nothing here deletes or
--     updates a redemption row, including by cascade.
--
--   * There is no identity-document data to retain. This feature stores no bill
--     amount, no document number, no image and no date of birth anywhere, so
--     erasure has none to scrub and the export has none to disclose. The offer
--     tables hold foreign keys, snapshotted benefit terms and timestamps, and
--     nothing else.
--
-- Retention window: this file encodes no new deletion period for a loyalty
-- ledger. Claims, entitlements and redemptions are retained and de-identified
-- by the customer-row anonymisation that admin_erase_customer_pii already
-- performs, which is the same "ledger retained, identity anonymised" model the
-- published privacy copy in lib/legal/content.ts describes for loyalty,
-- consent, fraud, billing, product-event and audit records. Only the 10-minute
-- pass scan tokens are hard-deleted, and they are ephemeral bearer material
-- rather than a personal record.
--
-- Forward-only and idempotent (create or replace).

-- 1. The cron sweep ------------------------------------------------------------
create or replace function public.expire_and_purge_offer_campaigns(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_today date := public.uk_business_date(v_now);
  v_affected integer := 0;
  v_count integer;
begin
  -- 1. Activate scheduled campaigns whose start date has arrived. A campaign
  -- whose window has ALREADY closed is left alone here so stage 2 retires it
  -- directly rather than parading it as live for a fraction of a transaction.
  update public.offer_campaigns
  set status = 'live'
  where status = 'scheduled'
    and starts_on <= v_today
    and ends_on >= v_today;
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  -- 2. Retire campaigns past their end date. The claim token is scrubbed in the
  -- same statement, exactly as end_offer_campaign does, so a printed poster
  -- stops resolving the moment the window closes; the hash and the merchant
  -- readable ciphertext are written and cleared together to satisfy
  -- offer_campaigns_token_coherent. Passes already issued are untouched.
  update public.offer_campaigns
  set status = 'ended',
      ended_at = coalesce(ended_at, v_now),
      claim_token_hash = null,
      claim_token_ciphertext = null
  where status in ('scheduled', 'live', 'paused')
    and ends_on < v_today;
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  -- 3. Expire passes that have reached the end of their OWN window. This is the
  -- only thing that retires an entitlement on a schedule, and it reads valid_to
  -- alone — never the campaign's status or dates.
  update public.offer_discount_entitlements
  set status = 'expired'
  where status = 'active'
    and valid_to < v_today;
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  -- 4. Purge dead scan tokens. Delegated to the existing housekeeping function
  -- so the "never destroy evidence of a redemption" rule lives in exactly one
  -- place: a spent token that was honoured is referenced by an append-only
  -- redemption row and survives; a spent or lapsed token that was not is bearer
  -- material with no further purpose.
  v_affected := v_affected
    + coalesce(public.purge_expired_offer_pass_scan_tokens(v_now), 0);

  return v_affected;
end;
$function$;

revoke all on function public.expire_and_purge_offer_campaigns(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_and_purge_offer_campaigns(timestamptz)
  to service_role;

-- 2. GDPR erasure companion -----------------------------------------------------
-- There is no contact detail, document number or date of birth in any offer
-- table, so there is nothing to scrub in the way the bulk-invitation companion
-- scrubs encrypted addresses and link tokens. What erasure must do instead is
-- stop the subject holding a live benefit and destroy the credentials that
-- would present it, then sever the claim linkage wherever no redemption
-- evidence sits beneath it.
--
-- offer_redemptions is deliberately EXCLUDED. It is append-only at both the
-- trigger and the ACL layer; it records that a venue honoured a discount, which
-- is the venue's own commercial and audit evidence; it holds no contact data;
-- and its customer linkage is de-identified by the customer-row anonymisation
-- admin_erase_customer_pii performs in the same request. Deleting a claim that
-- has redemptions beneath it would cascade into that ledger and be refused, so
-- such a claim is retained with its pass revoked instead.
create or replace function public.admin_erase_offer_claims_for_customer(
  p_customer_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_affected integer := 0;
  v_count integer;
begin
  if not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Admin privilege required';
  end if;

  -- 1. Destroy outstanding bearer material. A token that a redemption already
  -- references is evidence and is left where it is (the FK is ON DELETE
  -- RESTRICT, so removing it would abort the erasure).
  delete from public.offer_pass_scan_tokens t
  where t.customer_id = p_customer_id
    and not exists (
      select 1 from public.offer_redemptions r where r.scan_token_id = t.id
    );
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  -- 2. Revoke every pass the subject still holds, so nothing issued survives
  -- the erasure as a redeemable benefit. The snapshotted terms are not
  -- rewritten; only the status moves.
  update public.offer_discount_entitlements
  set status = 'revoked'
  where customer_id = p_customer_id
    and status <> 'revoked';
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  -- 3. Sever the claim linkage where nothing was ever honoured. The cascade
  -- removes the matching entitlement and its remaining tokens. A claim with a
  -- redemption beneath it stays, revoked, for the reason in the header above.
  delete from public.offer_campaign_claims c
  where c.customer_id = p_customer_id
    and not exists (
      select 1 from public.offer_redemptions r
      where r.customer_id = c.customer_id and r.campaign_id = c.campaign_id
    );
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  return v_affected;
end;
$function$;

revoke all on function public.admin_erase_offer_claims_for_customer(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_erase_offer_claims_for_customer(uuid)
  to authenticated, service_role;

-- 3. GDPR subject-access companion ----------------------------------------------
-- Everything the feature holds about one customer, in the three ledgers the
-- monolithic customer export does not reach. No contact detail is included
-- because none is stored; extra_terms is the venue's own published wording.
create or replace function public.offer_claims_export_for_customer(
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_claims jsonb;
  v_passes jsonb;
  v_redemptions jsonb;
begin
  if not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Admin privilege required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'campaign_id', c.campaign_id,
    'merchant_id', c.merchant_id,
    'membership_id', c.membership_id,
    'bonus_stamps_awarded', c.bonus_stamps_awarded,
    'claimed_at', c.claimed_at
  ) order by c.claimed_at desc), '[]'::jsonb)
  into v_claims
  from public.offer_campaign_claims c
  where c.customer_id = p_customer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'entitlement_id', e.id,
    'campaign_id', e.campaign_id,
    'merchant_id', e.merchant_id,
    'membership_id', e.membership_id,
    'discount_percent', e.discount_percent,
    'requires_id_check', e.requires_id_check,
    'extra_terms', e.extra_terms,
    'status', e.status,
    'valid_from', e.valid_from,
    'valid_to', e.valid_to,
    'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  into v_passes
  from public.offer_discount_entitlements e
  where e.customer_id = p_customer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'redemption_id', r.id,
    'entitlement_id', r.entitlement_id,
    'campaign_id', r.campaign_id,
    'merchant_id', r.merchant_id,
    'membership_id', r.membership_id,
    'discount_percent', r.discount_percent,
    'id_check_attested', r.id_check_attested,
    'no_stacking_attested', r.no_stacking_attested,
    'redeemed_at', r.redeemed_at
  ) order by r.redeemed_at desc), '[]'::jsonb)
  into v_redemptions
  from public.offer_redemptions r
  where r.customer_id = p_customer_id;

  return jsonb_build_object(
    'claims', v_claims,
    'discount_passes', v_passes,
    'redemptions', v_redemptions
  );
end;
$function$;

revoke all on function public.offer_claims_export_for_customer(uuid)
  from public, anon, authenticated;
grant execute on function public.offer_claims_export_for_customer(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
