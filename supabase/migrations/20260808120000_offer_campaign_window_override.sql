-- Offer campaign window ceiling — an approval is data, not DDL.
--
-- 20260808000000 extended the Old Crown Student & Staff Welcome Pass to three
-- years by naming its primary key and its exact dates inside the table-wide
-- CHECK offer_campaigns_window_valid. That turned one venue's approval into
-- part of the schema: a second approved exception would need another
-- drop/add of a table constraint under ACCESS EXCLUSIVE, and in every database
-- that does not hold that row the carve-out is a dead predicate evaluated on
-- every insert and update of the table.
--
-- This file replaces it with a per-campaign ceiling. offer_campaigns_window_valid
-- goes back to being one general rule; `max_window_days` is the inclusive
-- ceiling an approval may raise, and null means the standing 366. An approved
-- longer window becomes a reviewable row, and the mechanism is finally
-- exercisable without the production campaign — see
-- tests/db/offer-campaign-window-override.test.mjs.
--
-- It also restores the 4 August 2026 start that 20260808000000 moved forward.
-- The pass issued under that campaign carries valid_from = 2026-08-04, because
-- claim_offer_campaign stamps the claim date (20260803100200), so a 7 August
-- start left the ledger saying a customer claimed the offer three days before
-- it opened. Only the end date ever needed to move.
--
-- The merchant-facing rules are deliberately NOT relaxed:
-- create_offer_campaign_draft and lib/offers/campaign-core.ts still cap a
-- self-served window at 366 days. Raising max_window_days is an administrative
-- act on an existing row, never something a venue can grant itself.
--
-- Two different bars, deliberately. Drift in the CORRECTION is a skip: if the
-- venue has paused, ended, renamed or re-linked its campaign, section 3 leaves
-- the start date alone and says so. A window that NO approval covers is a hard
-- stop: section 4 re-validates the table and aborts, because shipping a general
-- rule the data does not satisfy is worse than a failed deploy.
--
-- Forward-only and re-runnable.

-- Every ALTER TABLE below takes ACCESS EXCLUSIVE on a table that serves live
-- claim traffic, starting with the very first one, and holds it to commit. Five
-- seconds is the whole budget: a busy table must fail this migration fast and
-- retryably rather than queue a lock request that stalls every reader behind it.
set local lock_timeout = '5s';

-- 1. The ceiling, as data -----------------------------------------------------
alter table public.offer_campaigns
  add column if not exists max_window_days integer;

alter table public.offer_campaigns
  drop constraint if exists offer_campaigns_max_window_days_sane;

alter table public.offer_campaigns
  add constraint offer_campaigns_max_window_days_sane
  check (max_window_days is null or max_window_days between 1 and 3660);

comment on column public.offer_campaigns.max_window_days is
  'Approved inclusive ceiling on this campaign''s window, in days. Null means the standing 366-day default. Written only by an administrative correction, and frozen after publication by offer_campaigns_terms_locked.';

-- 2. One general rule ---------------------------------------------------------
-- Added NOT VALID so the ordering is not circular: the row the carve-out used
-- to permit cannot satisfy the general rule until section 3 records its
-- ceiling, and section 3 cannot move a date while the carve-out still pins it.
-- NOT VALID skips only the initial scan — section 3's write is checked in full
-- — and section 4 re-scans the table once the data is settled.
alter table public.offer_campaigns
  drop constraint if exists offer_campaigns_window_valid;

alter table public.offer_campaigns
  add constraint offer_campaigns_window_valid
  check (
    ends_on >= starts_on
    and ends_on <= starts_on + coalesce(max_window_days, 366) - 1
  )
  not valid;

comment on constraint offer_campaigns_window_valid on public.offer_campaigns is
  'Inclusive campaign window: at most max_window_days days, defaulting to 366 when no longer window has been approved for the campaign.';

-- 3. Record the ceiling, and restore the start date the pass was claimed on ----
do $block$
declare
  v_campaign public.offer_campaigns%rowtype;
  v_needs_ceiling boolean;
  v_restore boolean;
  v_campaign_rows integer;
begin
  select c.*
  into v_campaign
  from public.offer_campaigns c
  where c.id = 'c1dfbf7d-8166-40d6-884c-1c659826d996'::uuid;

  if not found then
    return;
  end if;

  -- Two different things, with two different bars.
  --
  -- Recording the ceiling GRANTS NOTHING: 1100 is the exact inclusive length of
  -- 4 August 2026 – 7 August 2029, the window the carve-out already permitted.
  -- It therefore runs whatever else has drifted — a venue that paused or
  -- re-linked its campaign must not leave the table unable to re-validate.
  v_needs_ceiling :=
    v_campaign.ends_on > v_campaign.starts_on + 365
    and v_campaign.max_window_days is distinct from 1100;

  -- Restoring the start IS the correction, so it carries the SAME bar as
  -- 20260808000000 — down to the `girton` disqualifier — and is a skip, never an
  -- abort, because a venue can pause, end or re-link its own campaign at any
  -- moment and that must not fail a deploy. Anything weaker here would quietly
  -- undo that file's guards one migration later.
  v_restore :=
    v_campaign.merchant_id = 'cccd7192-bc88-4d65-b69d-4922e39fd906'::uuid
    and v_campaign.published_at is not null
    and v_campaign.status = 'live'
    and v_campaign.name is not distinct from 'Student & Staff Welcome Pass'
    and concat_ws(
      ' ',
      v_campaign.name,
      v_campaign.customer_description,
      v_campaign.extra_terms
    ) !~* 'girton'
    and v_campaign.token_generation = 1
    and v_campaign.claim_token_hash is not null
    and v_campaign.claim_token_ciphertext is not null
    and v_campaign.starts_on = date '2026-08-07'
    and v_campaign.ends_on = date '2029-08-07';

  if not v_needs_ceiling and not v_restore then
    return;
  end if;

  -- The bypass, open across exactly one statement. It takes only SHARE ROW
  -- EXCLUSIVE, and the constraint swap above has held ACCESS EXCLUSIVE on the
  -- table since the first statement of the file. Covering the ceiling write too
  -- is what keeps this file independent of whether section 5 has already frozen
  -- that column — on a replay, it has.
  execute
    'alter table public.offer_campaigns disable trigger offer_campaigns_terms_locked';

  update public.offer_campaigns
  set max_window_days =
        case when v_needs_ceiling then 1100 else max_window_days end,
      starts_on =
        case when v_restore then date '2026-08-04' else starts_on end
  where id = v_campaign.id
    and starts_on = v_campaign.starts_on
    and ends_on = v_campaign.ends_on
    and max_window_days is not distinct from v_campaign.max_window_days;
  get diagnostics v_campaign_rows = row_count;

  execute
    'alter table public.offer_campaigns enable trigger offer_campaigns_terms_locked';

  if v_campaign_rows = 0 then
    raise notice
      'Old Crown campaign changed while this migration ran; leaving it unchanged';
    return;
  end if;

  if not v_restore then
    raise notice
      'Old Crown campaign no longer matches the approved three-year window; ceiling recorded, start date left unchanged';
  end if;

  -- Every other mutation in this feature writes audit_logs beside its product
  -- event (publish, pause, resume, end, rotate, claim). A change to terms the
  -- lifecycle RPCs deliberately freeze is the strongest candidate of all, and
  -- 20260808000000 recorded only the product event. Both branches write it —
  -- recording a ceiling on a drifted campaign is still a write to frozen terms —
  -- and the metadata states what was actually done rather than what was hoped:
  -- `start_restored` false means only the ceiling moved, and the link fields are
  -- read off the row instead of asserting a preservation nothing checked.
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  )
  select
    'admin', 'codex-production-correction-2026-08-08', v_campaign.merchant_id,
    'offer_campaigns', v_campaign.id, 'offer_campaign_window_extended',
    jsonb_build_object(
      'previous_starts_on', v_campaign.starts_on,
      'starts_on',
        case when v_restore then date '2026-08-04' else v_campaign.starts_on end,
      'ends_on', v_campaign.ends_on,
      'max_window_days',
        case when v_needs_ceiling then 1100 else v_campaign.max_window_days end,
      'start_restored', v_restore,
      'campaign_status', v_campaign.status,
      'token_generation', v_campaign.token_generation,
      'claim_token_present', v_campaign.claim_token_hash is not null,
      'reason', 'approved three-year window; start restored to the date the first pass was claimed'
    )
  where not exists (
    select 1
    from public.audit_logs a
    where a.action = 'offer_campaign_window_extended'
      and a.target_id = v_campaign.id
  );
end;
$block$;

-- 4. Re-scan now that every row satisfies the general rule ---------------------
-- Takes SHARE UPDATE EXCLUSIVE rather than ACCESS EXCLUSIVE, so live reads keep
-- running. A failure here means a window exists that no approval covers.
alter table public.offer_campaigns
  validate constraint offer_campaigns_window_valid;

-- 5. Freeze the ceiling with the rest of the published terms -------------------
-- Without this, the one column that decides how long a published campaign may
-- run would be the only window input the post-publish lock did not hold.
create or replace function public.enforce_offer_campaign_terms_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if old.published_at is null then
    return new;
  end if;

  if new.merchant_id is distinct from old.merchant_id
    or new.bonus_stamp_count is distinct from old.bonus_stamp_count
    or new.discount_percent is distinct from old.discount_percent
    or new.starts_on is distinct from old.starts_on
    or new.ends_on is distinct from old.ends_on
    or new.max_window_days is distinct from old.max_window_days
    or new.requires_id_check is distinct from old.requires_id_check
    or new.extra_terms is distinct from old.extra_terms
  then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Published offer terms cannot be changed';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_offer_campaign_terms_locked()
  from public, anon, authenticated;
grant execute on function public.enforce_offer_campaign_terms_locked()
  to service_role;
