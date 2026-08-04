-- Merchant Offers and Campaign QR — campaign lifecycle RPCs.
--
-- Every function here is SECURITY DEFINER and service-role only. The Node layer
-- derives the claim token (HMAC of the campaign id + generation, never stored
-- raw) and passes down only its SHA-256 hash plus an encrypted copy; these RPCs
-- persist, transition and scrub them. Ownership is proved by the p_merchant_id
-- argument on every call, which the caller resolves from the merchant session.
--
-- The lifecycle is:
--   draft -> scheduled -> live -> paused -> live ... -> ended
-- 'scheduled' is a first-class state (a campaign published before its start
-- date), so publish and resume both resolve live vs scheduled from the UK
-- business date under the row lock. 'ended' is terminal.
--
-- Product rules encoded here, each of which is deliberate:
--   * One non-terminal campaign per venue, enforced twice: the partial unique
--     index from 20260803100000 and an advisory lock in the create path, so
--     concurrent creation queues instead of racing to a constraint violation.
--   * Publishing FREEZES the benefit, the dates, the ID rule and the extra
--     terms. There is no RPC that can edit them afterwards, and
--     enforce_offer_campaign_terms_locked below makes that a database rule
--     rather than an omission.
--   * Pausing and ending stop NEW claims only. Passes already issued keep their
--     snapshotted terms and remain redeemable until their own window closes;
--     nothing in this file touches offer_discount_entitlements.
--   * Rotating the link invalidates the previous link immediately by bumping
--     token_generation — the old derived token no longer hashes to the stored
--     value. Claims already made are untouched.
--
-- Forward-only and idempotent (create or replace / drop-before-create).

-- 0. Post-publish immutability -------------------------------------------------
-- The lifecycle columns (status, the timestamps, the token) keep moving after
-- publication; the promise made to the customer does not. A published campaign
-- whose benefit, window, ID rule or terms changed underneath a printed poster
-- would be a broken promise, so the database refuses it outright.
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

drop trigger if exists offer_campaigns_terms_locked on public.offer_campaigns;
create trigger offer_campaigns_terms_locked
  before update on public.offer_campaigns
  for each row execute function public.enforce_offer_campaign_terms_locked();

revoke all on function public.enforce_offer_campaign_terms_locked()
  from public, anon, authenticated;
grant execute on function public.enforce_offer_campaign_terms_locked()
  to service_role;

-- 1. Create the single draft campaign -----------------------------------------
-- The claim token is derived from the campaign id, which this function mints, so
-- the token arguments are normally null here and the link is installed by
-- rotate_offer_campaign_token once the caller knows the id. They are accepted
-- for the case where the caller already holds a matching pair.
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
  p_claim_token_ciphertext text
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
    bonus_stamp_count, discount_percent,
    starts_on, ends_on, requires_id_check, extra_terms,
    claim_token_hash, claim_token_ciphertext
  ) values (
    p_merchant_id, p_created_by, 'draft',
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
  uuid, uuid, integer, integer, date, date, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_offer_campaign_draft(
  uuid, uuid, integer, integer, date, date, boolean, text, text, text
) to service_role;

-- 2. Publish (or schedule) -----------------------------------------------------
create or replace function public.publish_offer_campaign(
  p_merchant_id uuid,
  p_campaign_id uuid,
  p_actor_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_campaign record;
  v_today date := public.uk_business_date(now());
  v_next text;
begin
  select c.id, c.status, c.starts_on, c.ends_on, c.claim_token_hash
  into v_campaign
  from public.offer_campaigns c
  where c.id = p_campaign_id and c.merchant_id = p_merchant_id
  for update;

  if v_campaign.id is null then
    raise exception 'Campaign not found';
  end if;
  if v_campaign.status = 'ended' then
    raise exception 'This offer has ended';
  end if;
  -- Already published: idempotent, so a double submit reports the same state
  -- rather than emitting a second published event.
  if v_campaign.status <> 'draft' then
    return v_campaign.status;
  end if;
  if v_campaign.claim_token_hash is null then
    raise exception 'This offer has no link yet';
  end if;
  if v_campaign.ends_on < v_today then
    raise exception 'The campaign window has already passed';
  end if;

  -- Scheduling IS publishing: the terms freeze here either way.
  v_next := case when v_campaign.starts_on <= v_today
    then 'live' else 'scheduled' end;

  update public.offer_campaigns
  set status = v_next, published_at = now(), paused_at = null
  where id = p_campaign_id;

  insert into public.product_events (
    event_name, merchant_id, actor_type, actor_id, metadata
  ) values (
    'offer_campaign_published', p_merchant_id, 'merchant',
    coalesce(p_actor_user_id::text, 'merchant'),
    jsonb_build_object('campaign_id', p_campaign_id, 'status', v_next)
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    'offer_campaigns', p_campaign_id, 'offer_campaign_published',
    jsonb_build_object('status', v_next)
  );

  return v_next;
end;
$function$;

revoke all on function public.publish_offer_campaign(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_offer_campaign(uuid, uuid, uuid)
  to service_role;

-- 3. Pause ---------------------------------------------------------------------
-- Stops new claims. Passes already issued keep working: nothing here touches
-- offer_discount_entitlements or offer_pass_scan_tokens.
create or replace function public.pause_offer_campaign(
  p_merchant_id uuid,
  p_campaign_id uuid,
  p_actor_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_status text;
begin
  select c.status into v_status
  from public.offer_campaigns c
  where c.id = p_campaign_id and c.merchant_id = p_merchant_id
  for update;

  if v_status is null then
    raise exception 'Campaign not found';
  end if;
  if v_status = 'ended' then
    raise exception 'This offer has ended';
  end if;
  if v_status = 'draft' then
    raise exception 'This offer has not been published yet';
  end if;
  if v_status = 'paused' then
    return 'paused';
  end if;

  update public.offer_campaigns
  set status = 'paused', paused_at = now()
  where id = p_campaign_id;

  insert into public.product_events (
    event_name, merchant_id, actor_type, actor_id, metadata
  ) values (
    'offer_campaign_paused', p_merchant_id, 'merchant',
    coalesce(p_actor_user_id::text, 'merchant'),
    jsonb_build_object('campaign_id', p_campaign_id, 'previous_status', v_status)
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    'offer_campaigns', p_campaign_id, 'offer_campaign_paused',
    jsonb_build_object('previous_status', v_status)
  );

  return 'paused';
end;
$function$;

revoke all on function public.pause_offer_campaign(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.pause_offer_campaign(uuid, uuid, uuid)
  to service_role;

-- 4. Resume --------------------------------------------------------------------
-- Resolves live vs scheduled the same way publish does, so resuming a campaign
-- that was paused before its start date parks it back in 'scheduled'.
create or replace function public.resume_offer_campaign(
  p_merchant_id uuid,
  p_campaign_id uuid,
  p_actor_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_campaign record;
  v_today date := public.uk_business_date(now());
  v_next text;
begin
  select c.id, c.status, c.starts_on, c.ends_on
  into v_campaign
  from public.offer_campaigns c
  where c.id = p_campaign_id and c.merchant_id = p_merchant_id
  for update;

  if v_campaign.id is null then
    raise exception 'Campaign not found';
  end if;
  if v_campaign.status = 'ended' then
    raise exception 'This offer has ended';
  end if;
  if v_campaign.status = 'draft' then
    raise exception 'This offer has not been published yet';
  end if;
  if v_campaign.status <> 'paused' then
    return v_campaign.status;
  end if;
  if v_campaign.ends_on < v_today then
    raise exception 'The campaign window has already passed';
  end if;

  v_next := case when v_campaign.starts_on <= v_today
    then 'live' else 'scheduled' end;

  update public.offer_campaigns
  set status = v_next, paused_at = null
  where id = p_campaign_id;

  insert into public.product_events (
    event_name, merchant_id, actor_type, actor_id, metadata
  ) values (
    'offer_campaign_resumed', p_merchant_id, 'merchant',
    coalesce(p_actor_user_id::text, 'merchant'),
    jsonb_build_object('campaign_id', p_campaign_id, 'status', v_next)
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    'offer_campaigns', p_campaign_id, 'offer_campaign_resumed',
    jsonb_build_object('status', v_next)
  );

  return v_next;
end;
$function$;

revoke all on function public.resume_offer_campaign(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resume_offer_campaign(uuid, uuid, uuid)
  to service_role;

-- 5. End (terminal) ------------------------------------------------------------
-- Scrubs the link so the printed poster stops working immediately, and frees the
-- one-non-terminal slot. Claims, entitlements and redemptions are left exactly
-- as they are: a pass issued yesterday is still honoured tomorrow.
create or replace function public.end_offer_campaign(
  p_merchant_id uuid,
  p_campaign_id uuid,
  p_actor_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_status text;
begin
  select c.status into v_status
  from public.offer_campaigns c
  where c.id = p_campaign_id and c.merchant_id = p_merchant_id
  for update;

  if v_status is null then
    raise exception 'Campaign not found';
  end if;
  if v_status = 'ended' then
    return 'ended';
  end if;
  -- offer_campaigns_published_shape forbids a terminal row with no published_at,
  -- and back-dating one would claim a publication that never happened. A draft
  -- is discarded by drafting again, which supersedes it.
  if v_status = 'draft' then
    raise exception 'This offer has not been published yet';
  end if;

  update public.offer_campaigns
  set status = 'ended',
      ended_at = now(),
      claim_token_hash = null,
      claim_token_ciphertext = null
  where id = p_campaign_id;

  insert into public.product_events (
    event_name, merchant_id, actor_type, actor_id, metadata
  ) values (
    'offer_campaign_ended', p_merchant_id, 'merchant',
    coalesce(p_actor_user_id::text, 'merchant'),
    jsonb_build_object('campaign_id', p_campaign_id, 'previous_status', v_status)
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    'offer_campaigns', p_campaign_id, 'offer_campaign_ended',
    jsonb_build_object('previous_status', v_status)
  );

  return 'ended';
end;
$function$;

revoke all on function public.end_offer_campaign(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.end_offer_campaign(uuid, uuid, uuid)
  to service_role;

-- 6. Install or rotate the claim link ------------------------------------------
-- The caller derives the token from (campaign id, generation) and sends down the
-- hash plus an encrypted copy. Installing the first link is not a rotation, so
-- it keeps generation 1; every later call increments, which invalidates the
-- previous link the instant this transaction commits. The resulting generation
-- is returned so the caller can confirm it matches the one it derived for.
create or replace function public.rotate_offer_campaign_token(
  p_merchant_id uuid,
  p_campaign_id uuid,
  p_claim_token_hash text,
  p_claim_token_ciphertext text,
  p_actor_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_campaign record;
  v_generation integer;
  v_rotated boolean;
begin
  if p_claim_token_hash is null or p_claim_token_ciphertext is null then
    raise exception 'A campaign link requires both a hash and a stored copy';
  end if;

  select c.id, c.status, c.token_generation, c.claim_token_hash
  into v_campaign
  from public.offer_campaigns c
  where c.id = p_campaign_id and c.merchant_id = p_merchant_id
  for update;

  if v_campaign.id is null then
    raise exception 'Campaign not found';
  end if;
  if v_campaign.status = 'ended' then
    raise exception 'This offer has ended';
  end if;

  v_rotated := v_campaign.claim_token_hash is not null;
  v_generation := case when v_rotated
    then v_campaign.token_generation + 1 else v_campaign.token_generation end;

  update public.offer_campaigns
  set claim_token_hash = p_claim_token_hash,
      claim_token_ciphertext = p_claim_token_ciphertext,
      token_generation = v_generation
  where id = p_campaign_id;

  if v_rotated then
    insert into public.product_events (
      event_name, merchant_id, actor_type, actor_id, metadata
    ) values (
      'offer_campaign_token_rotated', p_merchant_id, 'merchant',
      coalesce(p_actor_user_id::text, 'merchant'),
      jsonb_build_object('campaign_id', p_campaign_id, 'generation', v_generation)
    );
  end if;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    'offer_campaigns', p_campaign_id,
    case when v_rotated
      then 'offer_campaign_token_rotated' else 'offer_campaign_token_installed' end,
    jsonb_build_object('generation', v_generation)
  );

  return v_generation;
end;
$function$;

revoke all on function public.rotate_offer_campaign_token(
  uuid, uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.rotate_offer_campaign_token(
  uuid, uuid, text, text, uuid
) to service_role;

-- 7. Customer claim context ----------------------------------------------------
-- Read for the /offer/[token] landing. Returns availability plus the display
-- fields the page needs and nothing else — never the token, never a customer.
--
-- It takes the row lock and promotes a due 'scheduled' campaign to 'live'
-- itself, so activation is correct even if the retention sweep has not run.
create or replace function public.get_offer_claim_context(
  p_claim_token_hash text
)
returns table (
  claim_status text,
  business_name text,
  business_slug text,
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
