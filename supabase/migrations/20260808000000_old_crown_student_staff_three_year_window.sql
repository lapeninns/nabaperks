-- Old Crown Student & Staff Welcome Pass — approved three-year window.
--
-- Offer campaigns normally run for at most 366 inclusive days. The live Old
-- Crown campaign below is the sole approved exception: it keeps the existing
-- campaign and claim token so already printed QR codes and shared links remain
-- valid, while moving the campaign window to 7 August 2026–7 August 2029.
-- Every other campaign remains under the original one-year ceiling.
--
-- 20260808120000 supersedes the row-specific carve-out this file adds to
-- offer_campaigns_window_valid with a general per-campaign `max_window_days`
-- ceiling, and restores the 4 August start moved below. The DDL here is left
-- exactly as it was released; only the correction block was hardened.
--
-- The campaign is already published, so its dates are protected by
-- offer_campaigns_terms_locked. That trigger is bypassed for a single
-- compare-and-set statement and re-enabled on the very next line, with no
-- branch in between, so no path can commit with it still disabled. The
-- compare-and-set also carries the link-identity assertion a separate
-- after-the-fact re-check used to make.
--
-- Drift is a SKIP, never an abort. A venue can pause, end or re-link its own
-- campaign from the merchant desk at any moment, and a database restored from a
-- production snapshot can hold any number of issued passes; none of that may
-- turn a routine deploy into a failed migration.
--
-- Forward-only and re-runnable, including over a database that has already run
-- 20260808120000: the carve-out below accepts that file's restored 4 August
-- start, and the block then reads the window as already superseded and skips.

-- The first statement takes ACCESS EXCLUSIVE on a table that serves live claim
-- traffic, and holds it to commit. Five seconds is the whole budget: a busy
-- table must fail this migration fast and retryably rather than queue a lock
-- request that stalls every reader behind it.
set local lock_timeout = '5s';

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
        and starts_on in (date '2026-08-04', date '2026-08-07')
        and ends_on = date '2029-08-07'
      )
    )
  );

comment on constraint offer_campaigns_window_valid on public.offer_campaigns is
  'Campaigns run for at most 366 inclusive days, except the approved Old Crown Student & Staff Welcome Pass c1dfbf7d-8166-40d6-884c-1c659826d996, whose exact window is 2026-08-07 through 2029-08-07.';

do $block$
declare
  v_campaign public.offer_campaigns%rowtype;
  v_campaign_rows integer;
  v_passes_extended integer;
begin
  -- Unlocked probe. Every database but production is campaign-free here, and
  -- discovering that must not cost a lock on a table serving live claims.
  select c.*
  into v_campaign
  from public.offer_campaigns c
  where c.id = 'c1dfbf7d-8166-40d6-884c-1c659826d996'::uuid;

  if not found then
    return;
  end if;

  -- Identity, read before any lock is taken. `girton` alone is the
  -- disqualifier this correction was approved against: the campaign must no
  -- longer name the college it was first mis-scoped to. The generic word
  -- "college" is expected on a student offer ("show your university or college
  -- ID"), is merchant-editable free text, and is deliberately not matched.
  if v_campaign.merchant_id <> 'cccd7192-bc88-4d65-b69d-4922e39fd906'::uuid
    or v_campaign.status <> 'live'
    or v_campaign.published_at is null
    or v_campaign.name is distinct from 'Student & Staff Welcome Pass'
    or concat_ws(
      ' ',
      v_campaign.name,
      v_campaign.customer_description,
      v_campaign.extra_terms
    ) ~* 'girton'
    or v_campaign.token_generation <> 1
    or v_campaign.claim_token_hash is null
    or v_campaign.claim_token_ciphertext is null
    or (v_campaign.starts_on, v_campaign.ends_on) not in (
      (date '2026-08-04', date '2027-08-04'),
      (date '2026-08-07', date '2029-08-07')
    )
  then
    raise notice
      'Old Crown campaign no longer matches the approved three-year-window snapshot; leaving it unchanged';
    return;
  end if;

  -- The bypass, open across exactly one statement. This takes only SHARE ROW
  -- EXCLUSIVE, and the constraint swap above has held ACCESS EXCLUSIVE on the
  -- table since the first statement of the file, so nothing is escalated here
  -- and no reader is newly blocked.
  execute
    'alter table public.offer_campaigns disable trigger offer_campaigns_terms_locked';

  -- Compare-and-set against the probe. Under the table lock this transaction
  -- already holds, no concurrent writer can intervene; the predicate is the
  -- assertion that the row is still the one that was read, stated where it is
  -- enforced rather than as a separate re-check afterwards.
  update public.offer_campaigns
  set starts_on = date '2026-08-07',
      ends_on = date '2029-08-07'
  where id = v_campaign.id
    and status = 'live'
    and starts_on = v_campaign.starts_on
    and ends_on = v_campaign.ends_on
    and token_generation = v_campaign.token_generation
    and claim_token_hash is not distinct from v_campaign.claim_token_hash
    and claim_token_ciphertext
      is not distinct from v_campaign.claim_token_ciphertext;
  get diagnostics v_campaign_rows = row_count;

  execute
    'alter table public.offer_campaigns enable trigger offer_campaigns_terms_locked';

  -- Belt and braces: the table lock makes this unreachable, so it exists to
  -- report rather than to recover, and it reports instead of raising.
  if v_campaign_rows = 0 then
    raise notice
      'Old Crown campaign changed while this migration ran; leaving it unchanged';
    return;
  end if;

  -- EVERY active pass, not "the one we expected to find". The poster is in the
  -- wild, so a further claim between authoring and deploy is ordinary traffic:
  -- it must be extended too, never abort the deploy. The `valid_to <` predicate
  -- is also this statement's own idempotency guard on a replay, and a pass
  -- claimed after the campaign moved already carries the later date.
  update public.offer_discount_entitlements
  set valid_to = date '2029-08-07'
  where campaign_id = v_campaign.id
    and status = 'active'
    and valid_to < date '2029-08-07';
  get diagnostics v_passes_extended = row_count;

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
      'active_passes_extended', v_passes_extended,
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
