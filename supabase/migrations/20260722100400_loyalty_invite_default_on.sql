-- Bulk Two-Stamp Loyalty Invitations — remove all gating (default-on).
--
-- The feature is no longer behind a flag or a per-merchant allowlist: it is a
-- standard capability for every merchant. This migration removes the enablement
-- gate from create_loyalty_invite_draft, then drops the now-unused per-merchant
-- allowlist column and its admin toggle. Forward-only; the function is
-- reproduced verbatim minus the gate so it no longer references the dropped
-- column (replaced BEFORE the column is dropped).

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
  -- Bulk loyalty invitations are default-on for every merchant; no allowlist.
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

-- Retire the per-merchant allowlist machinery.
drop function if exists public.admin_set_merchant_loyalty_invites(uuid, boolean);
alter table public.merchants drop column if exists loyalty_invites_enabled;

notify pgrst, 'reload schema';
