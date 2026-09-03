-- Enforce single-use reward collection in the legacy service-role entry point
-- itself. The current-token wrapper is not a sufficient boundary while this
-- function remains directly executable by service integrations.

create or replace function public.collect_reward_scan_token(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  token_record record;
  redeem_record record;
  merchant_record record;
  v_reward_source text;
  v_reward_status text;
begin
  select tokens.*,
         rewards.status as reward_status
  into token_record
  from public.reward_scan_tokens tokens
  join public.reward_events rewards
    on rewards.id = tokens.reward_event_id
  where tokens.id = p_scan_token
  for update of tokens, rewards;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;

  if p_merchant_id is null
     or token_record.merchant_id is distinct from p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;

  if token_record.superseded_at is not null then
    raise exception 'Reward scan token superseded';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;

  if token_record.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;

  if token_record.reward_status = 'redeemed' then
    raise exception 'Reward already collected';
  end if;

  select
    redeemed.reward_event_id,
    redeemed.reward_name,
    redeemed.membership_id,
    redeemed.new_stamp_count
  into redeem_record
  from public.redeem_self_service_reward(
    token_record.reward_event_id,
    token_record.customer_id,
    null,
    null
  ) redeemed;

  update public.reward_scan_tokens
  set
    consumed_at = now(),
    consumed_by_merchant_id = p_merchant_id
  where id = p_scan_token
    and consumed_at is null
    and superseded_at is null;

  if not found then
    raise exception 'Reward scan token is no longer collectable';
  end if;

  select reward_events.source,
         reward_events.status
  into v_reward_source,
       v_reward_status
  from public.reward_events
  where reward_events.id = redeem_record.reward_event_id;

  if v_reward_status <> 'redeemed' then
    raise exception 'Reward collection did not complete';
  end if;

  if v_reward_source = 'stamp_cycle' then
    select merchants.business_name
    into merchant_record
    from public.merchants
    where merchants.id = p_merchant_id;

    perform public.enqueue_notification_event(
      'reward_collected_cycle_started',
      token_record.customer_id,
      p_merchant_id,
      redeem_record.membership_id,
      redeem_record.reward_event_id,
      null,
      public.uk_business_date(now()),
      now(),
      'reward_collected_cycle_started:' || redeem_record.reward_event_id::text,
      jsonb_build_object(
        'title', 'Reward collected',
        'body', 'A new ' || coalesce(merchant_record.business_name, 'venue') || ' stamp cycle has started.',
        'url', '/card/' || redeem_record.membership_id::text,
        'rewardEventId', redeem_record.reward_event_id,
        'membershipId', redeem_record.membership_id
      ),
      jsonb_build_object(
        'source', 'collect_reward_scan_token',
        'scan_token_expiry_separate', true
      )
    );
  end if;

  reward_event_id := redeem_record.reward_event_id;
  reward_name := redeem_record.reward_name;
  membership_id := redeem_record.membership_id;
  new_stamp_count := redeem_record.new_stamp_count;
  return next;
end;
$function$;

revoke all on function public.collect_reward_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.collect_reward_scan_token(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
