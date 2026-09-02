-- Keep one live merchant scan capability per reward and distinguish the caller
-- that performs the reward transition from a stale overlapping presentation.

alter table public.reward_scan_tokens
  add column if not exists superseded_at timestamptz;

-- Reconcile any overlap before adding the invariant. The newest token remains
-- live; older ephemeral capabilities are retired without pretending that a
-- merchant collected the reward.
with ranked as (
  select id,
         row_number() over (
           partition by reward_event_id
           order by expires_at desc, created_at desc, id desc
         ) as position
  from public.reward_scan_tokens
  where consumed_at is null
    and superseded_at is null
)
update public.reward_scan_tokens tokens
set superseded_at = now(),
    expires_at = least(tokens.expires_at, now())
from ranked
where ranked.id = tokens.id
  and ranked.position > 1;

create unique index if not exists reward_scan_tokens_one_live_per_reward_idx
  on public.reward_scan_tokens (reward_event_id)
  where consumed_at is null and superseded_at is null;

create or replace function public.retire_previous_reward_scan_tokens()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('reward-scan-token:' || new.reward_event_id::text, 0)
  );

  update public.reward_scan_tokens
  set superseded_at = clock_timestamp(),
      expires_at = least(expires_at, clock_timestamp())
  where reward_event_id = new.reward_event_id
    and consumed_at is null
    and superseded_at is null;

  return new;
end;
$function$;

drop trigger if exists reward_scan_tokens_retire_previous
  on public.reward_scan_tokens;
create trigger reward_scan_tokens_retire_previous
  before insert on public.reward_scan_tokens
  for each row execute function public.retire_previous_reward_scan_tokens();

revoke all on function public.retire_previous_reward_scan_tokens()
  from public, anon, authenticated;
grant execute on function public.retire_previous_reward_scan_tokens()
  to service_role;

create or replace function public.collect_current_reward_scan_token(
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
  v_token record;
begin
  select tokens.id,
         tokens.merchant_id,
         tokens.consumed_at,
         tokens.superseded_at,
         tokens.expires_at,
         rewards.status as reward_status
  into v_token
  from public.reward_scan_tokens tokens
  join public.reward_events rewards on rewards.id = tokens.reward_event_id
  where tokens.id = p_scan_token
  for update of tokens, rewards;

  if v_token.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;
  if v_token.merchant_id <> p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;
  if v_token.superseded_at is not null then
    raise exception 'Reward scan token superseded';
  end if;
  if v_token.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;
  if v_token.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;
  if v_token.reward_status = 'redeemed' then
    raise exception 'Reward already collected';
  end if;

  return query
  select * from public.collect_reward_scan_token(p_scan_token, p_merchant_id);
end;
$function$;

revoke all on function public.collect_current_reward_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.collect_current_reward_scan_token(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
