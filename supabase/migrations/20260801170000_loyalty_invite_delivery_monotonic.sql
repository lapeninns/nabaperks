-- Delivery-event application must be monotonic.
--
-- apply_loyalty_invite_delivery_event (20260722100100:408-459) protected only
-- 'opened'/'joined' from a 'delivered' event and only 'joined' from a failure.
-- The declared status domain has TEN values, so a replayed — or merely
-- late-arriving — `email.delivered` regressed a terminal recipient
-- (failed / unsubscribed / expired / cancelled) back to 'delivered' while its
-- failure evidence, nulled contact and tokens, and global suppression row all
-- persisted. Signature authenticity is not event consumption, and the ±300s
-- Standard-Webhooks window is a freshness check, not a replay guard.
--
-- Regressing 'cancelled' is the worst case: the lifetime-once index
-- (loyalty_invite_recipients_once_idx is `where status <> 'cancelled'`) treats
-- a cancelled recipient as re-invitable, so resurrecting one silently re-arms
-- dedupe for an address the venue had already withdrawn. Both
-- cancel_loyalty_invite_campaign and admin_erase_loyalty_invitations_for_customer
-- leave provider_message_id in place, so a late provider event can still find
-- the row.
--
-- Scope: this is the monotonic lattice ONLY. Same signature, same return type,
-- `create or replace` — so it deploys with no window in which Svix sees 500s
-- and needs no route change. Durable per-event consumption (exactly-once for a
-- replay arriving while the recipient is still in flight) is a separate,
-- larger change and is deliberately NOT bundled here.
--
-- Partially closes: resend-webhook-replay-state-regression.
CREATE OR REPLACE FUNCTION public.apply_loyalty_invite_delivery_event(p_provider_message_id text, p_event text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
    -- 'delivered' may only advance a recipient that is still in flight. It must
    -- never rewrite a TERMINAL state: a replayed or late-arriving delivered
    -- event previously resurrected a failed/unsubscribed/expired/cancelled
    -- recipient while its failure evidence, cleared tokens and suppression row
    -- all persisted. Regressing 'cancelled' is worse still, because the
    -- lifetime-once index is `where status <> 'cancelled'` — it silently
    -- re-armed dedupe for an address the venue had already withdrawn.
    update public.loyalty_invite_recipients
    set status = 'delivered',
        delivered_at = coalesce(delivered_at, now())
    where id = v_recipient.id
      and status in ('queued', 'sending', 'sent');
  elsif p_event in ('bounced', 'complained', 'failed') then
    -- A hard failure may claim any non-terminal state, but must not overwrite a
    -- decision the recipient or the venue already made ('joined', 'unsubscribed',
    -- 'cancelled') nor an expiry.
    update public.loyalty_invite_recipients
    set status = 'failed',
        failed_at = coalesce(failed_at, now()),
        failure_reason = p_event,
        email_ciphertext = null, email_masked = null,
        claim_token_hash = null, unsubscribe_token_hash = null
    where id = v_recipient.id
      and status in ('queued', 'sending', 'sent', 'delivered', 'opened');

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
$function$;

revoke all on function public.apply_loyalty_invite_delivery_event(text, text)
  from public, anon, authenticated;
grant execute on function public.apply_loyalty_invite_delivery_event(text, text)
  to service_role;

notify pgrst, 'reload schema';
