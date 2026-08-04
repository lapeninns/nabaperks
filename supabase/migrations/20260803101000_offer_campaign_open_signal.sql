-- Merchant Offers and Campaign QR — the recorded "offer link opened" signal.
--
-- The merchant desk reports four counts (claims, welcome stamps, passes in
-- date, pass redemptions) and every one of them reads a ledger this feature
-- writes. A fifth was asked for — how often the campaign link is opened — and
-- was deliberately left out, because nothing recorded it and a tile with no
-- ledger behind it is an invented number. This migration adds the ledger, so
-- the tile can exist and still be true.
--
-- WHY A ROLLUP COUNTER AND NOT A ROW PER VIEW
-- /offer/[token] is a public, unauthenticated page whose link is printed on a
-- poster. Its intended traffic shape is a surge: a roomful of people scanning
-- one code inside a few minutes, plus every link-preview fetcher and crawler
-- that ever meets the URL. A row per view would turn a page that needs no write
-- path at all into an unbounded, stranger-driven one, and a view row is only
-- worth keeping if it carries an address or a user agent — data this feature
-- has no reason to hold. So the signal is a counter, rolled up per campaign per
-- day:
--   * bounded — at most 366 rows for a campaign, because the window itself is
--     capped at 366 days (offer_campaigns_window_valid, 20260803100000);
--   * cheap — one upsert touching one row, issued from `after()` so it is never
--     on the render path and can never fail the page;
--   * anonymous — nothing about the visitor is stored, not even in aggregate.
-- The daily grain costs nothing over a single total and leaves a per-day chart
-- possible later without a second migration.
--
-- WHY ITS OWN TABLE AND NOT A COLUMN ON offer_campaigns
-- Two reasons, both structural. get_offer_claim_context already takes
-- `for update of c` on the campaign row for every landing render, so a counter
-- column would put a second write on the one row a scan surge already queues
-- behind. And enforce_offer_campaign_terms_locked (20260803100100) exists to
-- refuse writes to a published campaign; a per-scan counter would have to be
-- carved out of that guard, weakening it for the sake of a metric.
--
-- WHAT ONE COUNT MEANS, AND WHAT IT DOES NOT
-- One count is one load of the landing page at a moment when the offer was
-- genuinely claimable — the same condition get_offer_claim_context reports as
-- `available`. A load against a draft, a paused, a not-yet-open, an expired or
-- an ended campaign counts nothing; so does a load at a venue outside the pilot
-- allowlist, and so does a rotated or unknown token.
-- It counts PAGE LOADS, not people and not scans:
--   * a refresh, a back-navigation and a second device each add one;
--   * a messaging app's link preview or a crawler reaching the URL adds one;
--   * somebody who points a camera at the poster and never opens the page adds
--     none, so this is not a scan count;
--   * somebody who opens a link they were sent is indistinguishable from
--     somebody who scanned the poster.
-- None of that is separable without identifying the visitor, which this feature
-- will not do. The merchant-facing tile says so in plain words rather than
-- implying a precision it has not got. The landing page's rate limit (30
-- requests per 15 minutes per IP, enforced before anything else runs) bounds
-- how far one source can inflate the number; it does not make it exact.
--
-- Privacy and retention: the rollup holds no customer column, so there is
-- nothing here for erasure or export to reach. It is removed with its campaign
-- by the cascade, which is what the retention sweep in 20260803100500 already
-- drives.

-- 1. The rollup ---------------------------------------------------------------
create table public.offer_campaign_open_counts (
  campaign_id uuid not null
    references public.offer_campaigns(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  opened_on date not null,
  open_count bigint not null default 0,
  first_opened_at timestamptz not null default transaction_timestamp(),
  last_opened_at timestamptz not null default transaction_timestamp(),
  -- One row per campaign per UK business date. Also the campaign_id FK's
  -- support index, since campaign_id leads the key.
  constraint offer_campaign_open_counts_pkey primary key (campaign_id, opened_on),
  constraint offer_campaign_open_counts_count_positive check (open_count >= 0)
);

comment on table public.offer_campaign_open_counts is
  'Per-campaign, per-day count of landing-page loads made while the offer was claimable. Page loads, not people and not scans; holds nothing about the visitor.';
comment on column public.offer_campaign_open_counts.open_count is
  'Loads of /offer/[token] that resolved to claim_status = available on this UK business date. Repeat visits, link previews and crawlers are all included and cannot be separated.';

-- Complete, so the merchant_id FK's child lookup is covered on venue deletion;
-- the primary key is campaign-leading and cannot serve it.
create index offer_campaign_open_counts_merchant_id_idx
  on public.offer_campaign_open_counts (merchant_id);

-- 2. RLS ----------------------------------------------------------------------
alter table public.offer_campaign_open_counts enable row level security;
alter table public.offer_campaign_open_counts force row level security;

-- Venue-scoped like offer_campaigns itself: the owning merchant or an internal
-- admin may read; nobody but service_role may write.
drop policy if exists offer_campaign_open_counts_owner_or_admin_read
  on public.offer_campaign_open_counts;
create policy offer_campaign_open_counts_owner_or_admin_read
  on public.offer_campaign_open_counts
  for select
  to authenticated
  using (
    (select public.is_merchant_owner(merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists offer_campaign_open_counts_service
  on public.offer_campaign_open_counts;
create policy offer_campaign_open_counts_service
  on public.offer_campaign_open_counts
  for all
  to service_role
  using (true)
  with check (true);

-- 3. Table ACL ----------------------------------------------------------------
-- Never TRUNCATE / REFERENCES / TRIGGER / MAINTAIN to an API role.
revoke all on table public.offer_campaign_open_counts
  from public, anon, authenticated;
grant select on table public.offer_campaign_open_counts to authenticated;
grant select, insert, update, delete on table public.offer_campaign_open_counts
  to service_role;

-- 4. The recorder -------------------------------------------------------------
-- Resolves the campaign from the presented hash and decides claimability for
-- itself rather than trusting the caller, so an open cannot be attributed to a
-- campaign that was not accepting claims at the time, nor to a rotated or
-- unknown link. Deliberately takes NO lock on offer_campaigns: it reads the
-- campaign row and locks only its own counter row, so recording an open adds
-- nothing to the contention the claim path already carries.
--
-- Returns whether the open was counted, which is what the DB tier asserts on.
-- The application ignores it: this runs in `after()`, and a metric must never
-- be able to affect what the customer sees.
create or replace function public.record_offer_campaign_open(
  p_claim_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v record;
  v_today date := public.uk_business_date(now());
begin
  if p_claim_token_hash is null or btrim(p_claim_token_hash) = '' then
    return false;
  end if;

  select c.id, c.merchant_id, c.status, c.starts_on, c.ends_on,
         m.offer_campaigns_enabled
  into v
  from public.offer_campaigns c
  join public.merchants m on m.id = c.merchant_id
  where c.claim_token_hash = p_claim_token_hash;

  -- Exactly the condition get_offer_claim_context reports as 'available'.
  -- 'scheduled' is included because a scheduled campaign whose start date has
  -- arrived IS claimable; the context RPC promotes it to 'live' under its own
  -- lock, and this must not depend on which transaction commits first.
  if v.id is null
    or not v.offer_campaigns_enabled
    or v.status not in ('scheduled', 'live')
    or v_today < v.starts_on
    or v_today > v.ends_on
  then
    return false;
  end if;

  insert into public.offer_campaign_open_counts as counts (
    campaign_id, merchant_id, opened_on, open_count
  ) values (
    v.id, v.merchant_id, v_today, 1
  )
  on conflict (campaign_id, opened_on) do update
  set open_count = counts.open_count + 1,
      last_opened_at = transaction_timestamp();

  return true;
end;
$function$;

revoke all on function public.record_offer_campaign_open(text)
  from public, anon, authenticated;
grant execute on function public.record_offer_campaign_open(text)
  to service_role;

notify pgrst, 'reload schema';
