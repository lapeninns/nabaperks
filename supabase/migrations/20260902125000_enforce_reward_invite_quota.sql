-- Pending reward allocation is reachable directly by an authenticated merchant.
-- Enforce its resource quota and opaque-field bounds at the table boundary so
-- no RPC or future caller can bypass them.

create or replace function public.enforce_pending_reward_invite_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status not in ('pending', 'matched') then
    return new;
  end if;

  if new.email_hmac is not null and new.email_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite email hash';
  end if;

  if new.phone_hmac is not null and new.phone_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite phone hash';
  end if;

  if new.claim_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite claim token';
  end if;

  if new.unsubscribe_token_hash is not null
    and new.unsubscribe_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite unsubscribe token';
  end if;
  if new.email_hmac is not null and new.unsubscribe_token_hash is null then
    raise exception 'Email reward invites require an unsubscribe token';
  end if;
  if new.unsubscribe_token_hash = new.claim_token_hash then
    raise exception 'Reward invite capabilities must be purpose-separated';
  end if;

  if new.unsubscribe_token_hash is null then
    perform pg_advisory_xact_lock(hashtextextended(
      'reward-invite-capability:' || new.claim_token_hash, 0
    ));
  else
    perform pg_advisory_xact_lock(hashtextextended(
      'reward-invite-capability:' || least(
        new.claim_token_hash,
        new.unsubscribe_token_hash
      ), 0
    ));
    perform pg_advisory_xact_lock(hashtextextended(
      'reward-invite-capability:' || greatest(
        new.claim_token_hash,
        new.unsubscribe_token_hash
      ), 0
    ));
  end if;

  if exists (
    select 1
    from public.pending_reward_invites existing
    where existing.unsubscribe_token_hash = new.claim_token_hash
       or (
         new.unsubscribe_token_hash is not null
         and existing.claim_token_hash = new.unsubscribe_token_hash
       )
  ) then
    raise exception 'Reward invite capability already has another purpose';
  end if;

  if new.email_masked is not null
    and new.email_masked !~ '^[^[:space:]@]\*{3}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Invalid reward invite email mask';
  end if;

  if new.phone_last4 is not null and new.phone_last4 !~ '^[0-9]{4}$' then
    raise exception 'Invalid reward invite phone mask';
  end if;

  perform public.enforce_rate_limit(
    'reward-invite-allocation:' || new.merchant_id::text,
    50,
    86400000
  );

  return new;
end;
$function$;

-- Validate even a request that deduplicates before INSERT. The legacy function
-- remains service-role-only for internal compatibility; authenticated callers
-- and the server action use this checked wrapper.
create or replace function public.create_bounded_merchant_reward_invite(
  p_merchant_id uuid,
  p_email_hmac text,
  p_phone_hmac text,
  p_email_masked text,
  p_phone_last4 text,
  p_reward_name text,
  p_reward_terms text,
  p_personal_message text,
  p_reward_expires_after_days integer,
  p_claim_token_hash text,
  p_unsubscribe_token_hash text default null
)
returns table(invite_id uuid, deduped boolean)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
begin
  if p_email_hmac is not null and p_email_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite email hash';
  end if;
  if p_phone_hmac is not null and p_phone_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite phone hash';
  end if;
  if p_claim_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite claim token';
  end if;
  if p_unsubscribe_token_hash is not null
    and p_unsubscribe_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reward invite unsubscribe token';
  end if;
  if p_email_hmac is not null and p_unsubscribe_token_hash is null then
    raise exception 'Email reward invites require an unsubscribe token';
  end if;
  if p_unsubscribe_token_hash = p_claim_token_hash then
    raise exception 'Reward invite capabilities must be purpose-separated';
  end if;
  if p_email_masked is not null
    and p_email_masked !~ '^[^[:space:]@]\*{3}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Invalid reward invite email mask';
  end if;
  if p_phone_last4 is not null and p_phone_last4 !~ '^[0-9]{4}$' then
    raise exception 'Invalid reward invite phone mask';
  end if;

  return query
  select *
  from public.create_merchant_reward_invite(
    p_merchant_id,
    p_email_hmac,
    p_phone_hmac,
    p_email_masked,
    p_phone_last4,
    p_reward_name,
    p_reward_terms,
    p_personal_message,
    p_reward_expires_after_days,
    p_claim_token_hash,
    p_unsubscribe_token_hash
  );
end;
$function$;

drop trigger if exists pending_reward_invites_enforce_allocation
  on public.pending_reward_invites;
create trigger pending_reward_invites_enforce_allocation
  before insert on public.pending_reward_invites
  for each row execute function public.enforce_pending_reward_invite_allocation();

revoke all on function public.enforce_pending_reward_invite_allocation()
  from public, anon, authenticated;
grant execute on function public.enforce_pending_reward_invite_allocation()
  to service_role;

revoke all on function public.create_merchant_reward_invite(
  uuid, text, text, text, text, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.create_merchant_reward_invite(
  uuid, text, text, text, text, text, text, text, integer, text, text)
  to service_role;

revoke all on function public.create_bounded_merchant_reward_invite(
  uuid, text, text, text, text, text, text, text, integer, text, text)
  from public, anon;
grant execute on function public.create_bounded_merchant_reward_invite(
  uuid, text, text, text, text, text, text, text, integer, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
