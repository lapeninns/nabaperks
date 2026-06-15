alter table public.reward_events
  add column if not exists redeemed_by_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.redemption_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  public_token text not null unique,
  reward_event_id uuid not null references public.reward_events(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null references public.customer_memberships(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_user_id uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint redemption_tokens_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate
);

create unique index if not exists redemption_tokens_one_open_per_reward_idx
  on public.redemption_tokens (reward_event_id)
  where consumed_at is null and cancelled_at is null;

create index if not exists redemption_tokens_merchant_public_active_idx
  on public.redemption_tokens (merchant_id, public_token)
  where consumed_at is null and cancelled_at is null;

alter table public.redemption_tokens enable row level security;
alter table public.redemption_tokens force row level security;

create or replace function public.redemption_public_token()
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  token text := '';
begin
  for i in 1..12 loop
    token := token || substr(
      alphabet,
      1 + floor(random() * length(alphabet))::integer,
      1
    );
  end loop;

  return token;
end;
$$;

create or replace function public.create_redemption_token(
  p_reward_event_id uuid,
  p_customer_id uuid
)
returns table (
  token_id uuid,
  public_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  reward_record record;
  billing_status text;
  candidate_token text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id,
    reward_events.redeemable_from,
    customers.auth_user_id,
    customer_memberships.current_stamp_count,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers on customers.id = reward_events.customer_id
  join public.merchants on merchants.id = reward_events.merchant_id
  join public.loyalty_cards on loyalty_cards.id = reward_events.loyalty_card_id
  where reward_events.id = p_reward_event_id
  for update of reward_events;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  if reward_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or reward_record.auth_user_id is null
      or reward_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Reward ownership required';
    end if;
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not redeemable';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
  end if;

  if not reward_record.card_is_active then
    raise exception 'This loyalty card is not active';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  if reward_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = reward_record.merchant_id;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  select
    redemption_tokens.id,
    redemption_tokens.public_token,
    redemption_tokens.expires_at
  into token_id, public_token, expires_at
  from public.redemption_tokens
  where redemption_tokens.reward_event_id = reward_record.id
    and redemption_tokens.consumed_at is null
    and redemption_tokens.cancelled_at is null
    and redemption_tokens.expires_at > now()
  order by redemption_tokens.created_at desc
  limit 1;

  if token_id is not null then
    return next;
    return;
  end if;

  update public.redemption_tokens
  set cancelled_at = now()
  where redemption_tokens.reward_event_id = reward_record.id
    and redemption_tokens.consumed_at is null
    and redemption_tokens.cancelled_at is null;

  loop
    candidate_token := public.redemption_public_token();
    begin
      insert into public.redemption_tokens (
        public_token,
        reward_event_id,
        merchant_id,
        customer_id,
        membership_id,
        expires_at
      )
      values (
        candidate_token,
        reward_record.id,
        reward_record.merchant_id,
        reward_record.customer_id,
        reward_record.membership_id,
        now() + interval '10 minutes'
      )
      returning
        redemption_tokens.id,
        redemption_tokens.public_token,
        redemption_tokens.expires_at
      into token_id, public_token, expires_at;
      exit;
    exception
      when unique_violation then
        candidate_token := null;
    end;
  end loop;

  return next;
end;
$$;

create or replace function public.get_redemption_token_status(
  p_reward_event_id uuid,
  p_customer_id uuid
)
returns table (
  status text,
  consumed_at timestamptz,
  reward_name text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  reward_record record;
  token_record record;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    reward_events.id,
    reward_events.customer_id,
    reward_events.reward_name,
    reward_events.status,
    customers.auth_user_id
  into reward_record
  from public.reward_events
  join public.customers on customers.id = reward_events.customer_id
  where reward_events.id = p_reward_event_id;

  if reward_record.id is null then
    status := 'none';
    return next;
    return;
  end if;

  if reward_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or reward_record.auth_user_id is null
      or reward_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Reward ownership required';
    end if;
  end if;

  reward_name := reward_record.reward_name;

  if reward_record.status = 'redeemed' then
    status := 'consumed';
    select reward_events.redeemed_at into consumed_at
    from public.reward_events
    where reward_events.id = reward_record.id;
    return next;
    return;
  end if;

  select *
  into token_record
  from public.redemption_tokens
  where redemption_tokens.reward_event_id = reward_record.id
    and redemption_tokens.cancelled_at is null
  order by redemption_tokens.created_at desc
  limit 1;

  if token_record.id is null then
    status := 'none';
  elsif token_record.consumed_at is not null then
    status := 'consumed';
    consumed_at := token_record.consumed_at;
  elsif token_record.expires_at <= now() then
    status := 'expired';
  else
    status := 'pending';
  end if;

  return next;
end;
$$;

create or replace function public.lookup_redemption_token_for_merchant(
  p_public_token text,
  p_merchant_id uuid
)
returns table (
  status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  customer_label text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  token_record record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Merchant login required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select
    redemption_tokens.id,
    redemption_tokens.consumed_at,
    redemption_tokens.cancelled_at,
    redemption_tokens.expires_at,
    reward_events.id as reward_id,
    reward_events.status as reward_status,
    reward_events.reward_name,
    reward_events.reward_terms,
    customers.phone_last4,
    customers.email
  into token_record
  from public.redemption_tokens
  join public.reward_events on reward_events.id = redemption_tokens.reward_event_id
  join public.customers on customers.id = redemption_tokens.customer_id
  where redemption_tokens.public_token = upper(trim(p_public_token))
    and redemption_tokens.merchant_id = p_merchant_id;

  if token_record.id is null then
    status := 'not_found';
    return next;
    return;
  end if;

  reward_event_id := token_record.reward_id;
  reward_name := token_record.reward_name;
  reward_terms := token_record.reward_terms;
  expires_at := token_record.expires_at;
  customer_label := case
    when token_record.phone_last4 is not null then 'Phone ending ' || token_record.phone_last4
    when token_record.email is not null then token_record.email
    else 'Verified customer'
  end;

  if token_record.consumed_at is not null then
    status := 'consumed';
  elsif token_record.cancelled_at is not null then
    status := 'cancelled';
  elsif token_record.expires_at <= now() then
    status := 'expired';
  elsif token_record.reward_status <> 'unlocked' then
    status := 'unavailable';
  else
    status := 'ready';
  end if;

  return next;
end;
$$;

create or replace function public.consume_redemption_token(
  p_public_token text,
  p_merchant_id uuid
)
returns table (
  status text,
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer,
  consumed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  token_record record;
  reward_record record;
  billing_status text;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Merchant login required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select *
  into token_record
  from public.redemption_tokens
  where redemption_tokens.public_token = upper(trim(p_public_token))
    and redemption_tokens.merchant_id = p_merchant_id
  for update;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Redemption QR not found';
  end if;

  if token_record.consumed_at is not null then
    select
      reward_events.id,
      reward_events.reward_name,
      reward_events.membership_id,
      customer_memberships.current_stamp_count
    into reward_record
    from public.reward_events
    join public.customer_memberships
      on customer_memberships.id = reward_events.membership_id
    where reward_events.id = token_record.reward_event_id;

    status := 'redeemed';
    reward_event_id := reward_record.id;
    reward_name := reward_record.reward_name;
    membership_id := reward_record.membership_id;
    new_stamp_count := reward_record.current_stamp_count;
    consumed_at := token_record.consumed_at;
    return next;
    return;
  end if;

  if token_record.cancelled_at is not null then
    raise exception 'Redemption QR has been replaced';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'Redemption QR has expired';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id as reward_membership_id,
    reward_events.reward_name as assigned_reward_name,
    reward_events.redeemable_from,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    customer_memberships.current_stamp_count,
    merchants.status as merchant_status
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.merchants on merchants.id = reward_events.merchant_id
  join public.loyalty_cards on loyalty_cards.id = reward_events.loyalty_card_id
  where reward_events.id = token_record.reward_event_id
  for update of reward_events;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not redeemable';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
  end if;

  if not reward_record.card_is_active then
    raise exception 'This loyalty card is not active';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  if reward_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = reward_record.merchant_id;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  update public.reward_events
  set
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by_user_id = current_user_id,
    metadata = reward_events.metadata || jsonb_build_object(
      'redeemed_by', 'merchant_scan'
    )
  where reward_events.id = reward_record.id
    and reward_events.status = 'unlocked';

  if not found then
    raise exception 'Reward already redeemed';
  end if;

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
    total_rewards_redeemed = total_rewards_redeemed + 1
  where customer_memberships.id = reward_record.reward_membership_id
  returning current_stamp_count into new_stamp_count;

  update public.redemption_tokens
  set
    consumed_at = now(),
    consumed_by_user_id = current_user_id
  where redemption_tokens.id = token_record.id
  returning redemption_tokens.consumed_at into consumed_at;

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'reward_redeemed',
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.reward_membership_id,
    'merchant',
    current_user_id::text,
    jsonb_build_object(
      'reward_id', reward_record.id,
      'reward_name', reward_record.assigned_reward_name,
      'new_stamp_count', new_stamp_count,
      'redeemed_by', 'merchant_scan'
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    current_user_id::text,
    reward_record.merchant_id,
    reward_record.customer_id,
    'reward_events',
    reward_record.id,
    'reward_redeemed',
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'redeemed_by', 'merchant_scan',
      'redemption_token_id', token_record.id
    )
  );

  status := 'redeemed';
  reward_event_id := reward_record.id;
  reward_name := reward_record.assigned_reward_name;
  membership_id := reward_record.reward_membership_id;

  return next;
end;
$$;

revoke all on table public.redemption_tokens from public;
revoke all on function public.redemption_public_token() from public;
revoke all on function public.create_redemption_token(uuid, uuid) from public;
revoke all on function public.get_redemption_token_status(uuid, uuid) from public;
revoke all on function public.lookup_redemption_token_for_merchant(text, uuid) from public;
revoke all on function public.consume_redemption_token(text, uuid) from public;

grant execute on function public.create_redemption_token(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_redemption_token_status(uuid, uuid) to authenticated, service_role;
grant execute on function public.lookup_redemption_token_for_merchant(text, uuid) to authenticated;
grant execute on function public.consume_redemption_token(text, uuid) to authenticated;
