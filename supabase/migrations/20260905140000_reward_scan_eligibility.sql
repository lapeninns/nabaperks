-- A QR starts an in-person review; only collection requires verified DOB.
-- Keep the eligibility rules in the database for both minted and inserted tokens.
create or replace function private.reward_scan_eligibility_reason(p_reward_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_reward record;
begin
  select r.status, r.source, r.redeemable_from, r.expires_at,
         cm.current_stamp_count, lc.stamps_required,
         c.full_name, c.date_of_birth, c.email, c.email_verified_at,
         public.loyalty_availability_reason(
           m.status, lc.is_active, bc.status, m.requires_billing
         ) as unavailable_reason
  into v_reward
  from public.reward_events r
  join public.customer_memberships cm on cm.id = r.membership_id
  join public.customers c on c.id = r.customer_id
  join public.loyalty_cards lc on lc.id = r.loyalty_card_id
  join public.merchants m on m.id = r.merchant_id
  left join public.billing_customers bc on bc.merchant_id = r.merchant_id
  where r.id = p_reward_id;

  if not found then return 'Reward not found'; end if;
  if v_reward.status = 'redeemed' then return 'Reward already redeemed'; end if;
  if v_reward.status <> 'unlocked' then return 'Reward is not ready to collect'; end if;
  if v_reward.expires_at <= now() then return 'Reward expired'; end if;
  if v_reward.redeemable_from > public.uk_business_date(now()) then
    return 'Reward is not redeemable until the next UK business day';
  end if;
  if v_reward.unavailable_reason is not null then
    return 'This loyalty programme is unavailable right now';
  end if;
  if v_reward.source = 'stamp_cycle'
     and v_reward.current_stamp_count < v_reward.stamps_required then
    return 'Reward is not ready to redeem';
  end if;
  if nullif(btrim(v_reward.email), '') is null or v_reward.email_verified_at is null then
    return 'Verified email required for reward collection';
  end if;
  if nullif(btrim(v_reward.full_name), '') is null or v_reward.date_of_birth is null then
    return 'Complete your profile before redeeming';
  end if;
  if v_reward.date_of_birth > (public.uk_business_date(now()) - interval '18 years')::date then
    return 'Customer must be 18 or over to redeem';
  end if;
  if v_reward.date_of_birth < date '1900-01-01' then
    return 'Complete your profile before redeeming';
  end if;
  return null;
end;
$function$;

revoke all on function private.reward_scan_eligibility_reason(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.require_eligible_reward_for_scan_token()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_reward public.reward_events%rowtype;
  v_reason text;
begin
  -- Match collection/profile-update ordering: customer, reward, then tokens.
  perform 1 from public.customers where id = new.customer_id for update;
  select * into v_reward from public.reward_events
  where id = new.reward_event_id for update;
  if not found or v_reward.customer_id is distinct from new.customer_id
     or v_reward.merchant_id is distinct from new.merchant_id
     or v_reward.membership_id is distinct from new.membership_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;
  v_reason := private.reward_scan_eligibility_reason(new.reward_event_id);
  if v_reason is not null then raise exception '%', v_reason; end if;
  return new;
end;
$function$;

drop trigger if exists reward_scan_tokens_require_verified_dob on public.reward_scan_tokens;
-- Run before the existing token-retirement trigger takes any token locks.
create trigger a_reward_scan_tokens_require_eligible_reward
before insert on public.reward_scan_tokens
for each row execute function public.require_eligible_reward_for_scan_token();
revoke all on function public.require_eligible_reward_for_scan_token()
  from public, anon, authenticated, service_role;

create or replace function public.create_reward_scan_token(
  p_reward_event_id uuid, p_customer_id uuid
)
returns table (scan_token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_reward public.reward_events%rowtype;
  v_token public.reward_scan_tokens%rowtype;
  v_reason text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;
  perform 1 from public.customers where id = p_customer_id for update;
  select * into v_reward from public.reward_events
  where id = p_reward_event_id for update;
  if not found or v_reward.customer_id is distinct from p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;
  v_reason := private.reward_scan_eligibility_reason(p_reward_event_id);
  if v_reason is not null then raise exception '%', v_reason; end if;

  -- Global token retention remains the scheduled purge's responsibility.
  select * into v_token from public.reward_scan_tokens t
  where t.reward_event_id = p_reward_event_id
    and t.customer_id = p_customer_id
    and t.consumed_at is null and t.superseded_at is null
    and t.expires_at > now() + interval '5 minutes'
  order by t.expires_at desc limit 1;
  if v_token.id is not null then
    scan_token := v_token.id;
    expires_at := v_token.expires_at;
    return next;
    return;
  end if;
  insert into public.reward_scan_tokens (
    reward_event_id, merchant_id, customer_id, membership_id, expires_at
  ) values (
    v_reward.id, v_reward.merchant_id, v_reward.customer_id, v_reward.membership_id,
    least(now() + interval '10 minutes', v_reward.expires_at)
  ) returning id, reward_scan_tokens.expires_at into scan_token, expires_at;
  return next;
end;
$function$;

revoke all on function public.create_reward_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_reward_scan_token(uuid, uuid) to service_role;

-- No caller-supplied merchant ID: authority comes from the authenticated owner.
create or replace function private.reward_scan_owner_merchant(p_scan_token uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_merchant_id uuid;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated' then
    raise insufficient_privilege using message = 'Merchant owner access required';
  end if;
  select m.id into v_merchant_id
  from public.reward_scan_tokens t
  join public.merchants m on m.id = t.merchant_id
  where t.id = p_scan_token and m.owner_user_id = auth.uid();
  if v_merchant_id is null then
    raise insufficient_privilege using message = 'Reward not available to this merchant';
  end if;
  return v_merchant_id;
end;
$function$;

revoke all on function private.reward_scan_owner_merchant(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_owner_reward_scan_context(p_scan_token uuid)
returns table (
  scan_status text, reward_event_id uuid, reward_name text, reward_terms text,
  membership_id uuid, current_stamp_count integer, customer_email text,
  customer_phone_last4 text, blocked_reason text,
  customer_full_name text, customer_date_of_birth date
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_merchant_id uuid := private.reward_scan_owner_merchant(p_scan_token);
  v_context record;
  v_customer_id uuid;
  v_reason text;
begin
  select * into v_context from public.get_reward_scan_context(p_scan_token, v_merchant_id);
  scan_status := v_context.scan_status;
  reward_event_id := v_context.reward_event_id;
  reward_name := v_context.reward_name;
  reward_terms := v_context.reward_terms;
  membership_id := v_context.membership_id;
  current_stamp_count := v_context.current_stamp_count;
  customer_email := v_context.customer_email;
  customer_phone_last4 := v_context.customer_phone_last4;
  blocked_reason := v_context.blocked_reason;

  if scan_status = 'ready' then
    v_reason := private.reward_scan_eligibility_reason(reward_event_id);
    if v_reason is not null then
      scan_status := 'blocked';
      blocked_reason := v_reason;
    else
      select r.customer_id into v_customer_id
      from public.reward_events r where r.id = reward_event_id;
      if not public.customer_has_verified_adult_date_of_birth(v_customer_id) then
        scan_status := 'verification_required';
        select c.full_name, c.date_of_birth
        into customer_full_name, customer_date_of_birth
        from public.customers c where c.id = v_customer_id;
      end if;
    end if;
  end if;
  return next;
end;
$function$;

revoke all on function public.get_owner_reward_scan_context(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_owner_reward_scan_context(uuid) to authenticated;

notify pgrst, 'reload schema';
