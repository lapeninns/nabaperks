-- Loyalty-invite delivery settlement must be fenced by the claim generation.
--
-- 20260722100100:343-366 settled on recipient id alone. A worker whose
-- five-minute lease expired mid-send could therefore overwrite state written by
-- the worker that reclaimed the row: a stale 'retry' regressed a delivered
-- recipient back to 'queued' inside an already-'completed' campaign, where the
-- drain predicate (20260722100100:295 joins on c.status = 'sending') can never
-- claim it again. The recipient is stranded and never receives their invitation.
--
-- attempt_count is already monotonic, already incremented by the claim RPC and
-- already carried in LeasedRecipient, so it is a sufficient fencing token and no
-- schema change is needed. Same shape as the in-repo precedents
-- complete_merchant_weekly_digest / fail_merchant_weekly_digest
-- (20260721100000) and the Stripe webhook lease (20260710150000).
--
-- Closes: loyalty-invite-stale-lease-settlement.

-- Both the argument list and the return type change, so `create or replace` is
-- impossible; a surviving 5-argument overload would keep the unfenced path
-- reachable through PostgREST.
drop function if exists public.settle_loyalty_invite_send(uuid, text, text, timestamptz, text);

create or replace function public.settle_loyalty_invite_send(
  p_recipient_id uuid,
  p_expected_attempt_count integer,
  p_outcome text,
  p_provider_message_id text default null,
  p_next_attempt_at timestamptz default null,
  p_failure_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_campaign_id uuid;
  v_owner_campaign_id uuid;
begin
  -- Fail closed: a caller that cannot name its generation cannot settle.
  if p_expected_attempt_count is null then
    return false;
  end if;

  -- Captured before the branches so campaign completion can still be
  -- re-evaluated when this settlement loses its lease (see below).
  select campaign_id
  into v_owner_campaign_id
  from public.loyalty_invite_recipients
  where id = p_recipient_id;

  if v_owner_campaign_id is null then
    return false;
  end if;

  if p_outcome = 'sent' then
    update public.loyalty_invite_recipients
    set status = 'sent', sent_at = now(), lease_expires_at = null,
        provider_message_id = p_provider_message_id,
        failure_reason = null
    where id = p_recipient_id
      and status = 'sending'
      and attempt_count = p_expected_attempt_count
    returning campaign_id into v_campaign_id;
  elsif p_outcome = 'retry' then
    update public.loyalty_invite_recipients
    set status = 'queued', lease_expires_at = null,
        next_attempt_at = coalesce(p_next_attempt_at, now() + interval '15 minutes'),
        failure_reason = left(p_failure_reason, 300)
    where id = p_recipient_id
      and status = 'sending'
      and attempt_count = p_expected_attempt_count
    returning campaign_id into v_campaign_id;
  elsif p_outcome = 'failed' then
    update public.loyalty_invite_recipients
    set status = 'failed', failed_at = now(), lease_expires_at = null,
        failure_reason = left(p_failure_reason, 300),
        email_ciphertext = null, email_masked = null,
        claim_token_hash = null, unsubscribe_token_hash = null
    where id = p_recipient_id
      and status = 'sending'
      and attempt_count = p_expected_attempt_count
    returning campaign_id into v_campaign_id;
  else
    raise exception 'Unknown send outcome: %', p_outcome;
  end if;

  -- Completion is re-derived from current row state and self-guards on
  -- c.status = 'sending' plus "no queued/sending rows remain", so running it
  -- after a REJECTED settlement is safe — and skipping it is not. A concurrent
  -- unsubscribe or claim can move the row off 'sending' between the claim and
  -- the settle; if the rejected settle then returned early, the campaign would
  -- stay 'sending' forever and permanently block the next draft for that venue.
  perform public.complete_loyalty_invite_campaign_if_drained(v_owner_campaign_id);

  return v_campaign_id is not null;
end;
$$;

revoke all on function public.settle_loyalty_invite_send(uuid, integer, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.settle_loyalty_invite_send(uuid, integer, text, text, timestamptz, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- One-time heal for rows the unfenced function already stranded
-- ---------------------------------------------------------------------------
-- A 'queued' or 'sending' recipient inside a terminal campaign is unreachable
-- by the drain and can only be a stale-settle artifact: completion refuses to
-- fire while any queued/sending row exists, and cancellation cancels every
-- non-joined recipient. The repair differs by campaign disposition.

-- Completed campaigns: sent_at is the witness of what actually happened.
-- coalesce(failed_at, updated_at) rather than now(), so the heal does not drop
-- a burst of synthetic "failures" into the 24h operational-signals window.
update public.loyalty_invite_recipients r
set status = case when r.sent_at is not null then 'sent' else 'failed' end,
    failed_at = case when r.sent_at is null
                     then coalesce(r.failed_at, r.updated_at) else r.failed_at end,
    failure_reason = case when r.sent_at is null
                          then coalesce(r.failure_reason, 'stale_lease_settlement')
                          else r.failure_reason end,
    lease_expires_at = null,
    email_ciphertext = case when r.sent_at is null then null else r.email_ciphertext end,
    email_masked = case when r.sent_at is null then null else r.email_masked end,
    claim_token_hash = case when r.sent_at is null then null else r.claim_token_hash end,
    unsubscribe_token_hash = case when r.sent_at is null then null else r.unsubscribe_token_hash end
from public.loyalty_invite_campaigns c
where c.id = r.campaign_id
  and c.status = 'completed'
  and r.status in ('queued', 'sending');

-- Cancelled campaigns: repair to what cancellation itself would have written,
-- so the scrub is honoured and the lifetime-once index slot
-- (loyalty_invite_recipients_once_idx is `where status <> 'cancelled'`) is
-- freed and the address can be invited again.
update public.loyalty_invite_recipients r
set status = 'cancelled',
    lease_expires_at = null,
    email_ciphertext = null,
    email_masked = null,
    claim_token_hash = null,
    unsubscribe_token_hash = null
from public.loyalty_invite_campaigns c
where c.id = r.campaign_id
  and c.status = 'cancelled'
  and r.status in ('queued', 'sending');

notify pgrst, 'reload schema';
