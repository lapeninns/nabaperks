-- Old Crown Student & Staff Welcome Pass — approved three-year window.
--
-- Offer campaigns normally run for at most 366 inclusive days. The live Old
-- Crown campaign below is the sole approved exception: it keeps the existing
-- campaign and claim token so already printed QR codes and shared links remain
-- valid, while moving the campaign window to 7 August 2026–7 August 2029.
-- Every other campaign remains under the original one-year ceiling.
--
-- The campaign is already published, so its dates are protected by
-- offer_campaigns_terms_locked. The trigger is disabled only around the exact
-- guarded row update and is restored even if that update raises. The issued
-- active pass is extended to the same end date, and a product event records the
-- administrative correction without storing bearer material.
--
-- Forward-only and re-runnable.

alter table public.offer_campaigns
  drop constraint if exists offer_campaigns_window_valid;

alter table public.offer_campaigns
  add constraint offer_campaigns_window_valid
  check (
    ends_on >= starts_on
    and (
      ends_on <= starts_on + 365
      or (
        id = 'c1dfbf7d-8166-40d6-884c-1c659826d996'::uuid
        and starts_on = date '2026-08-07'
        and ends_on = date '2029-08-07'
      )
    )
  );

comment on constraint offer_campaigns_window_valid on public.offer_campaigns is
  'Campaigns run for at most 366 inclusive days, except the approved Old Crown Student & Staff Welcome Pass c1dfbf7d-8166-40d6-884c-1c659826d996, whose exact window is 2026-08-07 through 2029-08-07.';

do $block$
declare
  v_campaign public.offer_campaigns%rowtype;
  v_active_pass_id uuid;
  v_active_pass_count integer;
  v_campaign_rows integer;
  v_pass_rows integer;
begin
  select c.*
  into v_campaign
  from public.offer_campaigns c
  where c.id = 'c1dfbf7d-8166-40d6-884c-1c659826d996'::uuid
  for update;

  if not found then
    return;
  end if;

  if v_campaign.merchant_id <> 'cccd7192-bc88-4d65-b69d-4922e39fd906'::uuid
    or v_campaign.status <> 'live'
    or v_campaign.published_at is null
    or v_campaign.name <> 'Student & Staff Welcome Pass'
    or concat_ws(
      ' ',
      v_campaign.name,
      v_campaign.customer_description,
      v_campaign.extra_terms
    ) ~* '(girton|college)'
    or v_campaign.token_generation <> 1
    or v_campaign.claim_token_hash is null
    or v_campaign.claim_token_ciphertext is null
    or (v_campaign.starts_on, v_campaign.ends_on) not in (
      (date '2026-08-04', date '2027-08-04'),
      (date '2026-08-07', date '2029-08-07')
    )
  then
    raise exception
      'Old Crown campaign no longer matches the approved three-year-window snapshot';
  end if;

  select count(*)::integer
  into v_active_pass_count
  from public.offer_discount_entitlements e
  where e.campaign_id = v_campaign.id
    and e.status = 'active';

  if v_active_pass_count <> 1 then
    raise exception 'Expected exactly one active pass, found %', v_active_pass_count;
  end if;

  select e.id
  into strict v_active_pass_id
  from public.offer_discount_entitlements e
  where e.campaign_id = v_campaign.id
    and e.status = 'active'
    and e.valid_from = date '2026-08-04'
    and e.valid_to in (date '2027-08-04', date '2029-08-07')
  for update;

  execute
    'alter table public.offer_campaigns disable trigger offer_campaigns_terms_locked';

  begin
    update public.offer_campaigns
    set starts_on = date '2026-08-07',
        ends_on = date '2029-08-07'
    where id = v_campaign.id;
    get diagnostics v_campaign_rows = row_count;

    execute
      'alter table public.offer_campaigns enable trigger offer_campaigns_terms_locked';
  exception
    when others then
      execute
        'alter table public.offer_campaigns enable trigger offer_campaigns_terms_locked';
      raise;
  end;

  if v_campaign_rows <> 1 then
    raise exception 'Expected one campaign update, updated %', v_campaign_rows;
  end if;

  update public.offer_discount_entitlements
  set valid_to = date '2029-08-07'
  where id = v_active_pass_id;
  get diagnostics v_pass_rows = row_count;

  if v_pass_rows <> 1 then
    raise exception 'Expected one active-pass update, updated %', v_pass_rows;
  end if;

  if exists (
    select 1
    from public.offer_campaigns c
    where c.id = v_campaign.id
      and (
        c.claim_token_hash is distinct from v_campaign.claim_token_hash
        or c.claim_token_ciphertext is distinct from v_campaign.claim_token_ciphertext
        or c.token_generation is distinct from v_campaign.token_generation
      )
  ) then
    raise exception 'Offer link identity changed unexpectedly';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  select
    'offer_campaign_window_extended',
    v_campaign.merchant_id,
    'admin',
    'codex-production-correction-2026-08-07',
    jsonb_build_object(
      'campaign_id', v_campaign.id,
      'active_pass_id', v_active_pass_id,
      'previous_starts_on', v_campaign.starts_on,
      'previous_ends_on', v_campaign.ends_on,
      'new_starts_on', date '2026-08-07',
      'new_ends_on', date '2029-08-07',
      'active_pass_valid_to', date '2029-08-07',
      'qr_and_url_preserved', true,
      'token_generation', v_campaign.token_generation
    )
  where not exists (
    select 1
    from public.product_events p
    where p.event_name = 'offer_campaign_window_extended'
      and p.metadata->>'campaign_id' = v_campaign.id::text
  );
end;
$block$;
