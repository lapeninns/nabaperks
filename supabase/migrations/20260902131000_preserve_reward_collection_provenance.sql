-- Preserve idempotent self-service retries while preventing a customer-facing
-- redemption call from claiming success after a merchant already consumed a
-- scan token for the same reward.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

alter function public.redeem_self_service_reward(uuid, uuid, numeric, numeric)
  rename to redeem_self_service_reward_transition;
alter function public.redeem_self_service_reward_transition(
  uuid, uuid, numeric, numeric
) set schema private;

revoke all on function private.redeem_self_service_reward_transition(
  uuid, uuid, numeric, numeric
) from public, anon, authenticated, service_role;

create or replace function public.redeem_self_service_reward(
  p_reward_event_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null
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
  v_reward_status text;
begin
  select rewards.status
  into v_reward_status
  from public.reward_events rewards
  where rewards.id = p_reward_event_id
  for update;

  if v_reward_status = 'redeemed'
     and exists (
       select 1
       from public.reward_scan_tokens tokens
       where tokens.reward_event_id = p_reward_event_id
         and tokens.consumed_at is not null
     ) then
    raise exception 'Reward already collected by merchant';
  end if;

  return query
  select *
  from private.redeem_self_service_reward_transition(
    p_reward_event_id,
    p_customer_id,
    p_latitude,
    p_longitude
  );
end;
$function$;

revoke all on function public.redeem_self_service_reward(
  uuid, uuid, numeric, numeric
) from public, anon;
grant execute on function public.redeem_self_service_reward(
  uuid, uuid, numeric, numeric
) to authenticated, service_role;

notify pgrst, 'reload schema';
