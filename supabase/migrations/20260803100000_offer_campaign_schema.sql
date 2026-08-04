-- Merchant Offers and Campaign QR — schema, RLS and per-merchant allowlist.
--
-- A venue runs at most one non-terminal promotional offer at a time. Customers
-- who are NOT yet members scan a printed campaign QR, join, and receive the
-- snapshotted benefit: bonus stamps on their card, a repeat-use discount pass,
-- or both. Staff redeem the pass by scanning it and confirming two attestations.
--
-- Five ledgers live here:
--   offer_campaigns             the merchant-authored campaign and its token
--   offer_campaign_claims       one row per (campaign, customer), ever
--   offer_discount_entitlements the issued pass, with terms frozen at claim time
--   offer_pass_scan_tokens      short-lived bearer material for a single scan
--   offer_redemptions           the append-only record of each honoured scan
--
-- Deliberate omissions, each of which is a product rule rather than an oversight:
--   * No raw claim token is ever stored. The campaign keeps a SHA-256 hash plus
--     a token_generation counter; rotation increments the generation, which
--     invalidates every outstanding printed link by construction.
--   * No bill amount, no minimum spend, no identity-document number, no image
--     and no date of birth is stored anywhere in this feature. Minimum spend was
--     removed from this codebase on purpose (20260624120000); an equivalent must
--     not return under another name. `id_check_attested` is a staff attestation
--     boolean and nothing more.
--   * The discount pass is never consumed. Unlimited uses inside its window are
--     the point, so this feature does NOT reuse reward_events (single-collection
--     by construction) and does NOT flip an entitlement status on redemption.
--     Single use is enforced one level down, on the scan token.
--
-- Lifecycle RPCs, the claim transaction, pass scanning and retention arrive in
-- 20260803100100 / 20260803100200 / 20260803100300 / 20260803100400 /
-- 20260803100500. This file is structure only, plus the admin allowlist toggle.

-- 1. Per-merchant allowlist ("selected venues") -------------------------------
-- The global default-disabled feature flag (merchant_offer_campaigns) gates the
-- feature; this column selects which pilot venues may use it. Both must be true
-- (see lib/offers/access.ts).
alter table public.merchants
  add column if not exists offer_campaigns_enabled boolean not null default false;

-- 2. Campaign -----------------------------------------------------------------
-- 'scheduled' is a first-class state: publishing a campaign whose start date has
-- not arrived parks it there rather than pretending it is live, so the customer
-- landing page can say "this offer opens on <date>" instead of "expired".
-- Non-terminal = draft, scheduled, live, paused. Terminal = ended.
create table public.offer_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_by_user_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'live', 'paused', 'ended')),
  bonus_stamp_count integer check (bonus_stamp_count between 1 and 98),
  discount_percent integer check (discount_percent between 1 and 25),
  starts_on date not null,
  ends_on date not null,
  requires_id_check boolean not null default false,
  extra_terms text check (extra_terms is null or char_length(extra_terms) <= 500),
  claim_token_hash text unique,
  claim_token_ciphertext text,
  token_generation integer not null default 1 check (token_generation >= 1),
  published_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  -- At least one benefit, or the campaign offers the customer nothing.
  constraint offer_campaigns_benefit_present
    check (bonus_stamp_count is not null or discount_percent is not null),
  -- Inclusive span of at most 366 days.
  constraint offer_campaigns_window_valid
    check (ends_on >= starts_on and ends_on <= starts_on + 365),
  -- Scheduling IS publishing: benefits, dates, ID rules and terms are frozen
  -- from the moment a campaign leaves 'draft'.
  constraint offer_campaigns_published_shape
    check (status = 'draft' or published_at is not null),
  -- The hash and the merchant-readable ciphertext are written and scrubbed
  -- together; a campaign never holds one without the other.
  constraint offer_campaigns_token_coherent
    check ((claim_token_hash is null) = (claim_token_ciphertext is null))
);

-- One non-terminal campaign per venue. Paired in create_offer_campaign_draft
-- with pg_advisory_xact_lock so concurrent creation queues rather than races.
create unique index offer_campaigns_one_active_idx
  on public.offer_campaigns (merchant_id)
  where status in ('draft', 'scheduled', 'live', 'paused');

-- Complete and merchant-leading, so it also serves the merchant_id FK's child
-- lookup on venue deletion (the one_active index above is partial and cannot).
create index offer_campaigns_merchant_status_idx
  on public.offer_campaigns (merchant_id, status, created_at desc);

-- Retention/activation sweep: due windows only.
create index offer_campaigns_window_idx
  on public.offer_campaigns (ends_on)
  where status in ('scheduled', 'live', 'paused');

-- 3. Claim --------------------------------------------------------------------
-- One row per (campaign, customer) for all time. This is what makes a re-scan
-- of the same poster grant nothing.
create table public.offer_campaign_claims (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null
    references public.offer_campaigns(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null
    references public.customer_memberships(id) on delete cascade,
  bonus_stamps_awarded integer not null default 0
    check (bonus_stamps_awarded >= 0),
  claimed_at timestamptz not null default transaction_timestamp(),
  constraint offer_campaign_claims_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate,
  constraint offer_campaign_claims_once unique (campaign_id, customer_id)
);

create index offer_campaign_claims_merchant_id_idx
  on public.offer_campaign_claims (merchant_id);
create index offer_campaign_claims_customer_id_idx
  on public.offer_campaign_claims (customer_id);
create index offer_campaign_claims_membership_id_idx
  on public.offer_campaign_claims (membership_id);

-- 4. Discount entitlement (the pass) ------------------------------------------
-- discount_percent, requires_id_check, extra_terms and the window are SNAPSHOTS
-- taken at claim time. Editing or ending the campaign later must never rewrite
-- terms a customer has already been promised.
create table public.offer_discount_entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  claim_id uuid not null unique
    references public.offer_campaign_claims(id) on delete cascade,
  campaign_id uuid not null
    references public.offer_campaigns(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null
    references public.customer_memberships(id) on delete cascade,
  discount_percent integer not null check (discount_percent between 1 and 25),
  requires_id_check boolean not null,
  extra_terms text,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  valid_from date not null,
  valid_to date not null,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint offer_entitlements_window_valid check (valid_to >= valid_from),
  constraint offer_entitlements_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate
);

create index offer_discount_entitlements_campaign_id_idx
  on public.offer_discount_entitlements (campaign_id);
create index offer_discount_entitlements_merchant_id_idx
  on public.offer_discount_entitlements (merchant_id);
create index offer_discount_entitlements_customer_id_idx
  on public.offer_discount_entitlements (customer_id);
create index offer_discount_entitlements_membership_id_idx
  on public.offer_discount_entitlements (membership_id);

-- Customer wallet read: the live passes for one customer, soonest expiry first.
create index offer_discount_entitlements_live_idx
  on public.offer_discount_entitlements (customer_id, valid_to)
  where status = 'active';

-- 5. Pass scan token ----------------------------------------------------------
-- The token IS the row id — a bare uuid presented in the customer's pass QR,
-- exactly like reward_scan_tokens. Bearer material: service-role only, never
-- readable by an authenticated session.
-- The 10-minute TTL below and OFFER_PASS_SCAN_TOKEN_TTL_MS in
-- lib/offers/constants.ts must move together.
create table public.offer_pass_scan_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  entitlement_id uuid not null
    references public.offer_discount_entitlements(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null
    references public.customer_memberships(id) on delete cascade,
  created_at timestamptz not null default transaction_timestamp(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  consumed_by_merchant_id uuid
    references public.merchants(id) on delete set null,
  constraint offer_pass_scan_tokens_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate
);

-- Mint path: reuse an unconsumed, comfortably-live token rather than piling up
-- new bearer rows on every QR refresh.
create index offer_pass_scan_tokens_reusable_idx
  on public.offer_pass_scan_tokens (entitlement_id, customer_id, expires_at desc)
  where consumed_at is null;

-- The reusable index above is partial, so the entitlement_id FK needs a
-- complete index of its own to cover consumed rows too.
create index offer_pass_scan_tokens_entitlement_id_idx
  on public.offer_pass_scan_tokens (entitlement_id);
create index offer_pass_scan_tokens_merchant_id_idx
  on public.offer_pass_scan_tokens (merchant_id);
create index offer_pass_scan_tokens_customer_id_idx
  on public.offer_pass_scan_tokens (customer_id);
create index offer_pass_scan_tokens_membership_id_idx
  on public.offer_pass_scan_tokens (membership_id);
create index offer_pass_scan_tokens_consumed_by_merchant_id_idx
  on public.offer_pass_scan_tokens (consumed_by_merchant_id);

-- 6. Redemption ledger (immutable, append-only) -------------------------------
-- scan_token_id is UNIQUE and ON DELETE RESTRICT: one scan token can be
-- honoured exactly once, and the evidence of that redemption cannot be removed
-- by deleting the token underneath it. The entitlement itself is never
-- consumed — the customer may present the same pass again tomorrow.
-- No bill amount, no identity-document data and no date of birth is recorded.
create table public.offer_redemptions (
  id uuid primary key default extensions.gen_random_uuid(),
  entitlement_id uuid not null
    references public.offer_discount_entitlements(id) on delete cascade,
  campaign_id uuid not null
    references public.offer_campaigns(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null
    references public.customer_memberships(id) on delete cascade,
  scan_token_id uuid not null unique
    references public.offer_pass_scan_tokens(id) on delete restrict,
  discount_percent integer not null check (discount_percent between 1 and 25),
  id_check_attested boolean not null,
  no_stacking_attested boolean not null,
  redeemed_by_user_id uuid,
  redeemed_at timestamptz not null default transaction_timestamp(),
  -- The no-stacking line is always shown and always confirmed; the ID check is
  -- only asked for when the campaign requires it, so it is recorded but not
  -- forced here.
  constraint offer_redemptions_no_stacking_required check (no_stacking_attested),
  constraint offer_redemptions_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate
);

create index offer_redemptions_entitlement_id_idx
  on public.offer_redemptions (entitlement_id);
create index offer_redemptions_campaign_id_idx
  on public.offer_redemptions (campaign_id);
create index offer_redemptions_merchant_id_idx
  on public.offer_redemptions (merchant_id);
create index offer_redemptions_customer_id_idx
  on public.offer_redemptions (customer_id);
create index offer_redemptions_membership_id_idx
  on public.offer_redemptions (membership_id);

-- Merchant desk metrics: redemptions for one campaign, newest first.
create index offer_redemptions_campaign_metrics_idx
  on public.offer_redemptions (campaign_id, redeemed_at desc);

create or replace function public.enforce_offer_redemption_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  raise exception using
    errcode = 'insufficient_privilege',
    message = 'Offer redemptions are append-only';
end;
$function$;

create trigger offer_redemptions_append_only
  before update or delete on public.offer_redemptions
  for each row execute function public.enforce_offer_redemption_append_only();

revoke all on function public.enforce_offer_redemption_append_only()
  from public, anon, authenticated;
grant execute on function public.enforce_offer_redemption_append_only()
  to service_role;

-- 7. updated_at triggers ------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'offer_campaigns_set_updated_at'
  ) then
    create trigger offer_campaigns_set_updated_at
      before update on public.offer_campaigns
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'offer_discount_entitlements_set_updated_at'
  ) then
    create trigger offer_discount_entitlements_set_updated_at
      before update on public.offer_discount_entitlements
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- 8. RLS ----------------------------------------------------------------------
alter table public.offer_campaigns enable row level security;
alter table public.offer_campaigns force row level security;
alter table public.offer_campaign_claims enable row level security;
alter table public.offer_campaign_claims force row level security;
alter table public.offer_discount_entitlements enable row level security;
alter table public.offer_discount_entitlements force row level security;
alter table public.offer_pass_scan_tokens enable row level security;
alter table public.offer_pass_scan_tokens force row level security;
alter table public.offer_redemptions enable row level security;
alter table public.offer_redemptions force row level security;

-- Campaigns are venue-authored, so the owning merchant (or an internal admin)
-- reads them; the initplan form resolves ownership once per query, not per row.
drop policy if exists offer_campaigns_owner_or_admin_read on public.offer_campaigns;
create policy offer_campaigns_owner_or_admin_read on public.offer_campaigns
  for select
  to authenticated
  using (
    (select public.is_merchant_owner(merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists offer_campaigns_service on public.offer_campaigns;
create policy offer_campaigns_service on public.offer_campaigns
  for all
  to service_role
  using (true)
  with check (true);

-- Claims, entitlements and redemptions are visible to the customer they belong
-- to AND to the venue that issued them, via the set-returning ownership helpers.
drop policy if exists offer_campaign_claims_select_scoped on public.offer_campaign_claims;
create policy offer_campaign_claims_select_scoped on public.offer_campaign_claims
  for select
  to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

drop policy if exists offer_campaign_claims_service on public.offer_campaign_claims;
create policy offer_campaign_claims_service on public.offer_campaign_claims
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists offer_discount_entitlements_select_scoped
  on public.offer_discount_entitlements;
create policy offer_discount_entitlements_select_scoped
  on public.offer_discount_entitlements
  for select
  to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

drop policy if exists offer_discount_entitlements_service
  on public.offer_discount_entitlements;
create policy offer_discount_entitlements_service
  on public.offer_discount_entitlements
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists offer_redemptions_select_scoped on public.offer_redemptions;
create policy offer_redemptions_select_scoped on public.offer_redemptions
  for select
  to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

drop policy if exists offer_redemptions_service on public.offer_redemptions;
create policy offer_redemptions_service on public.offer_redemptions
  for all
  to service_role
  using (true)
  with check (true);

-- Scan tokens are bearer material: no authenticated policy and no authenticated
-- grant, so possession of the uuid is only ever checked server-side.
drop policy if exists offer_pass_scan_tokens_service on public.offer_pass_scan_tokens;
create policy offer_pass_scan_tokens_service on public.offer_pass_scan_tokens
  for all
  to service_role
  using (true)
  with check (true);

-- 9. Table ACLs ---------------------------------------------------------------
-- Never TRUNCATE / REFERENCES / TRIGGER / MAINTAIN to an API role.
revoke all on table public.offer_campaigns from public, anon, authenticated;
grant select on table public.offer_campaigns to authenticated;
grant select, insert, update, delete on table public.offer_campaigns
  to service_role;

revoke all on table public.offer_campaign_claims from public, anon, authenticated;
grant select on table public.offer_campaign_claims to authenticated;
grant select, insert, update, delete on table public.offer_campaign_claims
  to service_role;

revoke all on table public.offer_discount_entitlements
  from public, anon, authenticated;
grant select on table public.offer_discount_entitlements to authenticated;
grant select, insert, update, delete on table public.offer_discount_entitlements
  to service_role;

revoke all on table public.offer_pass_scan_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.offer_pass_scan_tokens
  to service_role;

-- Append-only: service_role gets SELECT and INSERT and nothing else, so the ACL
-- layer says the same thing as the trigger layer.
revoke all on table public.offer_redemptions from public, anon, authenticated;
grant select on table public.offer_redemptions to authenticated;
grant select, insert on table public.offer_redemptions to service_role;

-- 10. Admin allowlist toggle --------------------------------------------------
create or replace function public.admin_set_merchant_offer_campaigns(
  p_merchant_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_updated boolean;
begin
  if not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Admin privilege required';
  end if;

  update public.merchants
  set offer_campaigns_enabled = coalesce(p_enabled, false)
  where id = p_merchant_id
  returning true into v_updated;

  if v_updated then
    insert into public.audit_logs (
      actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
    ) values (
      'admin', (select auth.uid())::text, p_merchant_id,
      'merchants', p_merchant_id, 'offer_campaigns_allowlist_set',
      jsonb_build_object('enabled', coalesce(p_enabled, false))
    );
  end if;

  return coalesce(v_updated, false);
end;
$function$;

revoke all on function public.admin_set_merchant_offer_campaigns(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_set_merchant_offer_campaigns(uuid, boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';
