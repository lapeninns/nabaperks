-- Merchant Offers and Campaign QR — campaign name and customer description.
--
-- Step 2 of the offer creator asks for a campaign name and a short
-- customer-facing description. Neither had a column, so neither could be
-- collected, stored or shown. This migration adds both and threads them through
-- the two RPCs that write and read them.
--
-- Nullability, decided deliberately:
--   * Both columns are NULLABLE with length CHECKs only. 20260803100000 created
--     offer_campaigns without them, so any row that already exists has neither;
--     a NOT NULL column or a `status <> 'draft' or name is not null` constraint
--     would refuse to validate against those rows.
--   * A published campaign still always has a name, because the only way to
--     create a campaign is create_offer_campaign_draft and the only way to
--     publish one is publish_offer_campaign promoting an existing draft. The
--     merchant desk refuses a nameless draft (lib/offers/campaign-core.ts), so
--     every campaign created from here on carries one.
--   * Both are merchant-authored free text shown to customers, so the database
--     bounds their length and trims them, and every surface renders them as
--     text. Nothing in this feature renders merchant copy as HTML.
--
-- Both columns are read-only after creation: no RPC updates them, and
-- enforce_offer_campaign_terms_locked (20260803100100) already refuses any
-- change to a published campaign's promise.

-- 1. Columns -------------------------------------------------------------------
-- Bounds mirror OFFER_CAMPAIGN_NAME_MAX_LENGTH and
-- OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH in lib/offers/campaign-core.ts, in the
-- same style as the extra_terms CHECK in 20260803100000. They must move
-- together.
alter table public.offer_campaigns
  add column if not exists name text
    constraint offer_campaigns_name_length
    check (name is null or char_length(name) <= 60);

alter table public.offer_campaigns
  add column if not exists customer_description text
    constraint offer_campaigns_customer_description_length
    check (customer_description is null or char_length(customer_description) <= 160);

comment on column public.offer_campaigns.name is
  'Merchant-authored campaign name, shown to the merchant and to the customer. Bounded and trimmed; never rendered as HTML.';
comment on column public.offer_campaigns.customer_description is
  'Short customer-facing description of the offer. Bounded and trimmed; never rendered as HTML.';

-- 2. Create the draft, now carrying the identity -------------------------------
-- The argument list grows by two, so this is a drop-and-create rather than a
-- create-or-replace: adding parameters to an existing function produces an
-- overload, and a 10-argument call would then be ambiguous. The two new
-- parameters are last and default to null so existing positional callers keep
-- working; the merchant desk is the layer that requires a name.
drop function if exists public.create_offer_campaign_draft(
  uuid, uuid, integer, integer, date, date, boolean, text, text, text
);

create or replace function public.create_offer_campaign_draft(
  p_merchant_id uuid,
  p_created_by uuid,
  p_bonus_stamp_count integer,
  p_discount_percent integer,
  p_starts_on date,
  p_ends_on date,
  p_requires_id_check boolean,
  p_extra_terms text,
  p_claim_token_hash text,
  p_claim_token_ciphertext text,
  p_name text default null,
  p_customer_description text default null
)
returns table (campaign_id uuid, status text, stamps_required integer)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_card record;
  v_campaign_id uuid;
  v_terms text := nullif(btrim(coalesce(p_extra_terms, '')), '');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_description text := nullif(btrim(coalesce(p_customer_description, '')), '');
begin
  if not exists (
    select 1 from public.merchants m
    where m.id = p_merchant_id and m.offer_campaigns_enabled
  ) then
    raise insufficient_privilege using
      message = 'Offer campaigns are not enabled for this venue';
  end if;

  if p_starts_on is null or p_ends_on is null then
    raise exception 'A start date and an end date are required';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'The end date cannot be before the start date';
  end if;
  if p_ends_on > p_starts_on + 365 then
    raise exception 'A campaign can run for at most 366 days';
  end if;
  if p_ends_on < public.uk_business_date(now()) then
    raise exception 'The campaign window has already passed';
  end if;
  if p_bonus_stamp_count is null and p_discount_percent is null then
    raise exception 'Choose at least one benefit for this offer';
  end if;
  if char_length(coalesce(v_terms, '')) > 500 then
    raise exception 'Additional terms must be 500 characters or fewer';
  end if;
  if char_length(coalesce(v_name, '')) > 60 then
    raise exception 'A campaign name must be 60 characters or fewer';
  end if;
  if char_length(coalesce(v_description, '')) > 160 then
    raise exception 'A campaign description must be 160 characters or fewer';
  end if;

  -- The bonus grant must never complete a card on its own, so the ceiling is
  -- the venue's active card length minus one. stamps_required can change after
  -- publication, which is why claim_offer_campaign re-checks this at claim time
  -- rather than trusting the value frozen here.
  select lc.id, lc.stamps_required
  into v_card
  from public.loyalty_cards lc
  where lc.merchant_id = p_merchant_id and lc.is_active
  order by lc.created_at asc
  limit 1;

  if v_card.id is null then
    raise exception 'This venue has no active loyalty card';
  end if;
  if p_bonus_stamp_count is not null
    and p_bonus_stamp_count > coalesce(v_card.stamps_required, 0) - 1
  then
    raise exception 'Bonus stamps must be fewer than the % needed for a reward',
      v_card.stamps_required;
  end if;

  -- Serialise campaign creation per venue so the one-non-terminal rule holds
  -- under concurrency instead of surfacing a unique-index violation.
  perform pg_advisory_xact_lock(
    hashtextextended('offer-campaign:' || p_merchant_id::text, 0)
  );

  if exists (
    select 1 from public.offer_campaigns c
    where c.merchant_id = p_merchant_id
      and c.status in ('scheduled', 'live', 'paused')
  ) then
    raise exception 'This venue already has an offer running';
  end if;

  -- Re-drafting supersedes the previous draft; a draft has never been published
  -- so nothing has been promised to a customer and nothing can have been
  -- claimed against it.
  delete from public.offer_campaigns c
  where c.merchant_id = p_merchant_id and c.status = 'draft';

  insert into public.offer_campaigns (
    merchant_id, created_by_user_id, status,
    name, customer_description,
    bonus_stamp_count, discount_percent,
    starts_on, ends_on, requires_id_check, extra_terms,
    claim_token_hash, claim_token_ciphertext
  ) values (
    p_merchant_id, p_created_by, 'draft',
    v_name, v_description,
    p_bonus_stamp_count, p_discount_percent,
    p_starts_on, p_ends_on, coalesce(p_requires_id_check, false), v_terms,
    p_claim_token_hash, p_claim_token_ciphertext
  )
  returning id into v_campaign_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_created_by::text, 'merchant'), p_merchant_id,
    'offer_campaigns', v_campaign_id, 'offer_campaign_drafted',
    jsonb_build_object(
      'name', v_name,
      'bonus_stamp_count', p_bonus_stamp_count,
      'discount_percent', p_discount_percent,
      'starts_on', p_starts_on,
      'ends_on', p_ends_on,
      'requires_id_check', coalesce(p_requires_id_check, false)
    )
  );

  campaign_id := v_campaign_id;
  status := 'draft';
  stamps_required := v_card.stamps_required;
  return next;
end;
$function$;

revoke all on function public.create_offer_campaign_draft(
  uuid, uuid, integer, integer, date, date, boolean, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_offer_campaign_draft(
  uuid, uuid, integer, integer, date, date, boolean, text, text, text, text, text
) to service_role;

-- 3. Customer claim context, now carrying the identity -------------------------
-- The return type gains two columns, and PostgreSQL refuses to replace a
-- function whose OUT parameters change — so this too is a drop-and-create. The
-- argument list is unchanged, so no caller has to move.
drop function if exists public.get_offer_claim_context(text);

create or replace function public.get_offer_claim_context(
  p_claim_token_hash text
)
returns table (
  claim_status text,
  business_name text,
  business_slug text,
  campaign_name text,
  customer_description text,
  bonus_stamp_count integer,
  discount_percent integer,
  requires_id_check boolean,
  extra_terms text,
  starts_on date,
  ends_on date
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v record;
  v_today date := public.uk_business_date(now());
begin
  claim_status := 'unavailable';

  if p_claim_token_hash is null or btrim(p_claim_token_hash) = '' then
    return next; return;
  end if;

  select c.id, c.status, c.starts_on, c.ends_on,
         c.name, c.customer_description,
         c.bonus_stamp_count, c.discount_percent,
         c.requires_id_check, c.extra_terms,
         m.business_name, m.business_slug, m.offer_campaigns_enabled
  into v
  from public.offer_campaigns c
  join public.merchants m on m.id = c.merchant_id
  where c.claim_token_hash = p_claim_token_hash
  for update of c;

  -- A draft link is not a public link, and the allowlist doubles as the venue
  -- kill switch.
  if v.id is null or v.status in ('draft', 'ended') or not v.offer_campaigns_enabled then
    return next; return;
  end if;

  business_name := v.business_name;
  business_slug := v.business_slug;
  starts_on := v.starts_on;
  ends_on := v.ends_on;

  if v_today > v.ends_on then
    claim_status := 'expired';
    return next; return;
  end if;
  if v.status = 'paused' then
    claim_status := 'paused';
    return next; return;
  end if;
  -- Before the start date the customer is told when it opens, never that it
  -- expired.
  if v_today < v.starts_on then
    claim_status := 'not_started';
    return next; return;
  end if;

  if v.status = 'scheduled' then
    update public.offer_campaigns set status = 'live' where id = v.id;
  end if;

  claim_status := 'available';
  -- The name and the description are only released once the offer is claimable.
  -- A recovery state names the venue and the dates and nothing else, so a
  -- guessed or leaked link reveals no unopened campaign's copy.
  campaign_name := v.name;
  customer_description := v.customer_description;
  bonus_stamp_count := v.bonus_stamp_count;
  discount_percent := v.discount_percent;
  requires_id_check := v.requires_id_check;
  extra_terms := v.extra_terms;
  return next;
end;
$function$;

revoke all on function public.get_offer_claim_context(text)
  from public, anon, authenticated;
grant execute on function public.get_offer_claim_context(text)
  to service_role;

notify pgrst, 'reload schema';
