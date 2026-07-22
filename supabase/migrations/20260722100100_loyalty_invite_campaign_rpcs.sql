-- Bulk Two-Stamp Loyalty Invitations — campaign lifecycle + delivery RPCs.
--
-- All SECURITY DEFINER, service-role only. The Node action generates the
-- recipient row ids, email ciphertext/HMAC/mask and the two token *hashes*
-- (never the raw tokens); these RPCs persist and transition them. Eligibility
-- (existing member / suppressed / previously-invited) is resolved here in one
-- pass so it cannot be raced from the client.
--
-- Forward-only and idempotent (create or replace / drop-before-create).

-- 1. Create (or replace) the single draft campaign + queue eligible recipients.
create or replace function public.create_loyalty_invite_draft(
  p_merchant_id uuid,
  p_created_by uuid,
  p_recipient_ids uuid[],
  p_email_hmacs text[],
  p_email_ciphertexts text[],
  p_email_maskeds text[],
  p_claim_token_hashes text[],
  p_unsubscribe_token_hashes text[],
  p_invalid_count integer,
  p_duplicate_count integer
)
returns table (campaign_id uuid, eligible_count integer, not_eligible_count integer)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_candidate_count integer := coalesce(array_length(p_recipient_ids, 1), 0);
  v_eligible_count integer;
  v_recent_sends integer;
  v_daily_cap constant integer := 2000;
  v_campaign_id uuid;
begin
  if not exists (
    select 1 from public.merchants
    where id = p_merchant_id and loyalty_invites_enabled
  ) then
    raise insufficient_privilege using message = 'Loyalty invitations are not enabled for this venue';
  end if;

  if v_candidate_count > v_daily_cap then
    raise exception 'A campaign may include at most % addresses', v_daily_cap;
  end if;

  -- Serialise campaign creation per merchant so the one-active rule holds.
  perform pg_advisory_xact_lock(
    hashtextextended('loyalty-invite-campaign:' || p_merchant_id::text, 0)
  );

  if exists (
    select 1 from public.loyalty_invite_campaigns
    where merchant_id = p_merchant_id and status = 'sending'
  ) then
    raise exception 'A campaign is already in progress';
  end if;

  -- Replace any existing draft (a re-preview supersedes the previous one).
  delete from public.loyalty_invite_campaigns
  where merchant_id = p_merchant_id and status = 'draft';

  select count(*) into v_recent_sends
  from public.loyalty_invite_recipients
  where merchant_id = p_merchant_id
    and sent_at is not null
    and sent_at >= now() - interval '24 hours';

  insert into public.loyalty_invite_campaigns (merchant_id, created_by_user_id, status)
  values (p_merchant_id, p_created_by, 'draft')
  returning id into v_campaign_id;

  -- Insert only eligible candidates — not an existing member, not suppressed
  -- (global or venue), and not previously invited by this venue. One pass, no
  -- temp table, so a re-preview in the same transaction is safe.
  insert into public.loyalty_invite_recipients (
    id, campaign_id, merchant_id, email_hmac, email_ciphertext, email_masked,
    claim_token_hash, unsubscribe_token_hash, status, next_attempt_at
  )
  select t.recipient_id, v_campaign_id, p_merchant_id, t.email_hmac, t.ciphertext,
         t.masked, t.claim_hash, t.unsub_hash, 'queued', now()
  from unnest(
    p_recipient_ids, p_email_hmacs, p_email_ciphertexts,
    p_email_maskeds, p_claim_token_hashes, p_unsubscribe_token_hashes
  ) as t(recipient_id, email_hmac, ciphertext, masked, claim_hash, unsub_hash)
  where not exists (
      select 1 from public.customer_memberships m
      join public.customers cu on cu.id = m.customer_id
      where m.merchant_id = p_merchant_id and cu.email_hmac = t.email_hmac
    )
    and not exists (
      select 1 from public.loyalty_invite_email_suppressions s
      where s.email_hmac = t.email_hmac
        and (s.merchant_id is null or s.merchant_id = p_merchant_id)
    )
    and not exists (
      select 1 from public.loyalty_invite_recipients r
      where r.merchant_id = p_merchant_id
        and r.email_hmac = t.email_hmac
        and r.status <> 'cancelled'
        and r.campaign_id <> v_campaign_id
    );
  get diagnostics v_eligible_count = row_count;

  -- Enforce the 2,000-per-24h cap atomically (rolls back the inserts above).
  if v_recent_sends + v_eligible_count > v_daily_cap then
    raise exception 'Sending these would exceed the % per 24 hours limit', v_daily_cap;
  end if;

  update public.loyalty_invite_campaigns
  set eligible_count = v_eligible_count,
      invalid_count = coalesce(p_invalid_count, 0),
      duplicate_count = coalesce(p_duplicate_count, 0),
      not_eligible_count = v_candidate_count - v_eligible_count
  where id = v_campaign_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_created_by::text, 'system'), p_merchant_id,
    'loyalty_invite_campaigns', v_campaign_id, 'loyalty_invite_campaign_drafted',
    jsonb_build_object('eligible', v_eligible_count, 'candidates', v_candidate_count)
  );

  campaign_id := v_campaign_id;
  eligible_count := v_eligible_count;
  not_eligible_count := v_candidate_count - v_eligible_count;
  return next;
end;
$$;

revoke all on function public.create_loyalty_invite_draft(
  uuid, uuid, uuid[], text[], text[], text[], text[], text[], integer, integer
) from public, anon, authenticated;
grant execute on function public.create_loyalty_invite_draft(
  uuid, uuid, uuid[], text[], text[], text[], text[], text[], integer, integer
) to service_role;

-- 2. Confirm a draft -> sending, stamping the audited legal basis + link expiry.
create or replace function public.confirm_loyalty_invite_campaign(
  p_merchant_id uuid,
  p_campaign_id uuid,
  p_legal_basis text,
  p_link_ttl_days integer default 30,
  p_actor_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_status text;
begin
  if p_legal_basis not in ('venue_email_consent', 'existing_customer_soft_opt_in') then
    raise exception 'A valid legal basis is required';
  end if;

  select status into v_status
  from public.loyalty_invite_campaigns
  where id = p_campaign_id and merchant_id = p_merchant_id
  for update;

  if v_status is null then
    raise exception 'Campaign not found';
  end if;
  if v_status <> 'draft' then
    return false;
  end if;

  update public.loyalty_invite_campaigns
  set status = 'sending',
      legal_basis = p_legal_basis,
      link_expires_at = now() + make_interval(days => greatest(coalesce(p_link_ttl_days, 30), 1)),
      confirmed_at = now()
  where id = p_campaign_id;

  -- A campaign whose eligible list filtered down to zero has nothing to drain;
  -- complete it immediately so it never appears stuck "in progress".
  perform public.complete_loyalty_invite_campaign_if_drained(p_campaign_id);

  insert into public.product_events (
    event_name, merchant_id, actor_type, actor_id, metadata
  ) values (
    'loyalty_invite_campaign_sent', p_merchant_id, 'merchant',
    coalesce(p_actor_user_id::text, 'merchant'),
    jsonb_build_object('campaign_id', p_campaign_id, 'legal_basis', p_legal_basis)
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    'loyalty_invite_campaigns', p_campaign_id, 'loyalty_invite_campaign_confirmed',
    jsonb_build_object('legal_basis', p_legal_basis)
  );

  return true;
end;
$$;

revoke all on function public.confirm_loyalty_invite_campaign(uuid, uuid, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_loyalty_invite_campaign(uuid, uuid, text, integer, uuid)
  to service_role;

-- 3. Cancel: stop unsent deliveries, invalidate unclaimed links, scrub.
create or replace function public.cancel_loyalty_invite_campaign(
  p_merchant_id uuid,
  p_campaign_id uuid,
  p_actor_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.loyalty_invite_campaigns
  where id = p_campaign_id and merchant_id = p_merchant_id
  for update;

  if v_status is null then
    raise exception 'Campaign not found';
  end if;
  -- A 'completed' campaign has drained its queue but its already-sent links stay
  -- claimable until the 30-day expiry, so it must remain revocable to invalidate
  -- those unclaimed links.
  if v_status not in ('draft', 'sending', 'completed') then
    return false;
  end if;

  -- Every non-joined recipient is cancelled and its contact + tokens scrubbed;
  -- sent email cannot be recalled, but the link stops working immediately.
  update public.loyalty_invite_recipients
  set status = 'cancelled',
      email_ciphertext = null,
      email_masked = null,
      claim_token_hash = null,
      unsubscribe_token_hash = null,
      lease_expires_at = null
  where campaign_id = p_campaign_id and status <> 'joined';

  update public.loyalty_invite_campaigns
  set status = 'cancelled', cancelled_at = now()
  where id = p_campaign_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    'loyalty_invite_campaigns', p_campaign_id, 'loyalty_invite_campaign_cancelled',
    jsonb_build_object('previous_status', v_status)
  );

  return true;
end;
$$;

revoke all on function public.cancel_loyalty_invite_campaign(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_loyalty_invite_campaign(uuid, uuid, uuid)
  to service_role;

-- 4. Lease a batch of due recipients for the drain worker (skip locked).
create or replace function public.claim_due_loyalty_invite_recipients(
  p_now timestamptz,
  p_limit integer
)
returns table (
  recipient_id uuid,
  campaign_id uuid,
  merchant_id uuid,
  email_ciphertext text,
  attempt_count integer,
  business_name text,
  business_slug text,
  link_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 800);
  v_now timestamptz := coalesce(p_now, now());
begin
  return query
  with due as (
    select r.id
    from public.loyalty_invite_recipients r
    join public.loyalty_invite_campaigns c on c.id = r.campaign_id
    where c.status = 'sending'
      and (
        (r.status = 'queued' and r.next_attempt_at <= v_now)
        or (r.status = 'sending' and r.lease_expires_at is not null and r.lease_expires_at <= v_now)
      )
    order by r.next_attempt_at asc, r.created_at asc
    limit v_limit
    for update of r skip locked
  ),
  leased as (
    update public.loyalty_invite_recipients r
    set status = 'sending',
        attempt_count = r.attempt_count + 1,
        lease_expires_at = v_now + interval '5 minutes'
    from due
    where r.id = due.id
    returning r.id, r.campaign_id, r.merchant_id, r.email_ciphertext, r.attempt_count
  )
  select leased.id, leased.campaign_id, leased.merchant_id, leased.email_ciphertext,
         leased.attempt_count, m.business_name, m.business_slug, c.link_expires_at
  from leased
  join public.loyalty_invite_campaigns c on c.id = leased.campaign_id
  join public.merchants m on m.id = leased.merchant_id;
end;
$$;

revoke all on function public.claim_due_loyalty_invite_recipients(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_loyalty_invite_recipients(timestamptz, integer)
  to service_role;

-- 5. Settle a send attempt: sent / retry / failed. Completes the campaign when
--    no recipients remain in flight.
create or replace function public.settle_loyalty_invite_send(
  p_recipient_id uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_next_attempt_at timestamptz default null,
  p_failure_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_campaign_id uuid;
begin
  if p_outcome = 'sent' then
    update public.loyalty_invite_recipients
    set status = 'sent', sent_at = now(), lease_expires_at = null,
        provider_message_id = p_provider_message_id
    where id = p_recipient_id
    returning campaign_id into v_campaign_id;
  elsif p_outcome = 'retry' then
    update public.loyalty_invite_recipients
    set status = 'queued', lease_expires_at = null,
        next_attempt_at = coalesce(p_next_attempt_at, now() + interval '15 minutes'),
        failure_reason = left(p_failure_reason, 300)
    where id = p_recipient_id
    returning campaign_id into v_campaign_id;
  elsif p_outcome = 'failed' then
    update public.loyalty_invite_recipients
    set status = 'failed', failed_at = now(), lease_expires_at = null,
        failure_reason = left(p_failure_reason, 300),
        email_ciphertext = null, email_masked = null,
        claim_token_hash = null, unsubscribe_token_hash = null
    where id = p_recipient_id
    returning campaign_id into v_campaign_id;
  else
    raise exception 'Unknown send outcome: %', p_outcome;
  end if;

  perform public.complete_loyalty_invite_campaign_if_drained(v_campaign_id);
end;
$$;

revoke all on function public.settle_loyalty_invite_send(uuid, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.settle_loyalty_invite_send(uuid, text, text, timestamptz, text)
  to service_role;

-- 6. Mark a campaign completed once nothing is queued or in flight.
create or replace function public.complete_loyalty_invite_campaign_if_drained(
  p_campaign_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if p_campaign_id is null then
    return;
  end if;
  update public.loyalty_invite_campaigns c
  set status = 'completed', completed_at = now()
  where c.id = p_campaign_id
    and c.status = 'sending'
    and not exists (
      select 1 from public.loyalty_invite_recipients r
      where r.campaign_id = c.id and r.status in ('queued', 'sending')
    );
end;
$$;

revoke all on function public.complete_loyalty_invite_campaign_if_drained(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_loyalty_invite_campaign_if_drained(uuid)
  to service_role;

-- 7. Apply a Resend delivery webhook event, keyed by the provider message id.
--    Bounces/complaints suppress globally; delivered/failed just annotate.
create or replace function public.apply_loyalty_invite_delivery_event(
  p_provider_message_id text,
  p_event text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_recipient record;
begin
  if p_provider_message_id is null or btrim(p_provider_message_id) = '' then
    return false;
  end if;

  select id, email_hmac, status
  into v_recipient
  from public.loyalty_invite_recipients
  where provider_message_id = p_provider_message_id
  for update;

  if v_recipient.id is null then
    return false;
  end if;

  if p_event = 'delivered' then
    update public.loyalty_invite_recipients
    set status = case when status in ('opened', 'joined') then status else 'delivered' end,
        delivered_at = coalesce(delivered_at, now())
    where id = v_recipient.id;
  elsif p_event in ('bounced', 'complained', 'failed') then
    update public.loyalty_invite_recipients
    set status = case when status = 'joined' then status else 'failed' end,
        failed_at = coalesce(failed_at, now()),
        failure_reason = p_event,
        email_ciphertext = null, email_masked = null,
        claim_token_hash = null, unsubscribe_token_hash = null
    where id = v_recipient.id;

    if p_event in ('bounced', 'complained') then
      insert into public.loyalty_invite_email_suppressions (merchant_id, email_hmac, reason)
      values (null, v_recipient.email_hmac, p_event)
      on conflict do nothing;
    end if;
  else
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.apply_loyalty_invite_delivery_event(text, text)
  from public, anon, authenticated;
grant execute on function public.apply_loyalty_invite_delivery_event(text, text)
  to service_role;

-- 8. "Opened" = the invitation link was visited (no tracking pixels).
create or replace function public.mark_loyalty_invite_opened(
  p_claim_token_hash text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  update public.loyalty_invite_recipients
  set status = 'opened', opened_at = coalesce(opened_at, now())
  where claim_token_hash = p_claim_token_hash
    and status in ('sent', 'delivered');
end;
$$;

revoke all on function public.mark_loyalty_invite_opened(text)
  from public, anon, authenticated;
grant execute on function public.mark_loyalty_invite_opened(text)
  to service_role;

-- 9. Venue-scoped unsubscribe, resolved by the recipient's unsubscribe token.
create or replace function public.suppress_loyalty_invite_email(
  p_unsubscribe_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_recipient record;
begin
  select id, merchant_id, email_hmac, status
  into v_recipient
  from public.loyalty_invite_recipients
  where unsubscribe_token_hash = p_unsubscribe_token_hash
  for update;

  if v_recipient.id is null then
    return false;
  end if;

  insert into public.loyalty_invite_email_suppressions (merchant_id, email_hmac, reason)
  values (v_recipient.merchant_id, v_recipient.email_hmac, 'unsubscribed')
  on conflict do nothing;

  update public.loyalty_invite_recipients
  set status = case when status = 'joined' then status else 'unsubscribed' end,
      unsubscribed_at = coalesce(unsubscribed_at, now())
  where id = v_recipient.id;

  return true;
end;
$$;

revoke all on function public.suppress_loyalty_invite_email(text)
  from public, anon, authenticated;
grant execute on function public.suppress_loyalty_invite_email(text)
  to service_role;

-- 10. Read the claim context for the /invite/[token] landing (no PII leaked).
create or replace function public.get_loyalty_invite_claim_context(
  p_claim_token_hash text
)
returns table (claim_status text, business_name text, business_slug text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v record;
begin
  select r.status as recipient_status, c.status as campaign_status,
         c.link_expires_at, m.business_name, m.business_slug
  into v
  from public.loyalty_invite_recipients r
  join public.loyalty_invite_campaigns c on c.id = r.campaign_id
  join public.merchants m on m.id = r.merchant_id
  where r.claim_token_hash = p_claim_token_hash;

  if v.recipient_status is null
     or v.recipient_status not in ('sent', 'delivered', 'opened')
     or v.campaign_status = 'cancelled' then
    claim_status := 'unavailable';
    return next; return;
  end if;

  if v.link_expires_at is not null and v.link_expires_at < now() then
    claim_status := 'expired';
    return next; return;
  end if;

  claim_status := 'available';
  business_name := v.business_name;
  business_slug := v.business_slug;
  return next;
end;
$$;

revoke all on function public.get_loyalty_invite_claim_context(text)
  from public, anon, authenticated;
grant execute on function public.get_loyalty_invite_claim_context(text)
  to service_role;

notify pgrst, 'reload schema';
