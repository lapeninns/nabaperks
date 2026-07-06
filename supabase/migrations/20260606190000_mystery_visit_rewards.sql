create or replace function public.uk_business_date(p_at timestamptz default now())
returns date
language sql
stable
set search_path = public
as $$
  select (p_at at time zone 'Europe/London')::date;
$$;

create or replace function public.next_uk_business_date(p_at timestamptz default now())
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  v_date date := (p_at at time zone 'Europe/London')::date + 1;
begin
  while extract(isodow from v_date) in (6, 7) loop
    v_date := v_date + 1;
  end loop;

  return v_date;
end;
$$;

alter table public.loyalty_cards
  alter column stamps_required set default 3,
  alter column reward_name set default 'Surprise reward';

create table if not exists public.reward_pool_items (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid not null references public.merchant_locations(id) on delete cascade,
  loyalty_card_id uuid not null references public.loyalty_cards(id) on delete cascade,
  reward_name text not null check (length(trim(reward_name)) between 1 and 100),
  reward_terms text not null check (length(trim(reward_terms)) between 12 and 500),
  min_spend_pence integer check (min_spend_pence is null or min_spend_pence >= 0),
  weight integer not null default 1 check (weight between 1 and 1000),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, location_id, loyalty_card_id, id),
  constraint reward_pool_items_location_matches_merchant
    foreign key (merchant_id, location_id)
    references public.merchant_locations(merchant_id, id)
    on delete cascade
    deferrable initially immediate,
  constraint reward_pool_items_card_matches_context
    foreign key (merchant_id, location_id, loyalty_card_id)
    references public.loyalty_cards(merchant_id, location_id, id)
    on delete cascade
    deferrable initially immediate
);

alter table public.reward_events
  add column if not exists reward_pool_item_id uuid references public.reward_pool_items(id) on delete set null,
  add column if not exists reward_name text,
  add column if not exists reward_terms text,
  add column if not exists min_spend_pence integer check (min_spend_pence is null or min_spend_pence >= 0),
  add column if not exists redeemable_from date;

alter table public.stamp_events
  add column if not exists earned_business_date date;

update public.stamp_events
set earned_business_date = public.uk_business_date(created_at)
where event_type = 'earned'
  and earned_business_date is null;

-- Replay guard (MS-db-dead-field-cleanup, 2026-07-07): this one-time backfill
-- completed in 2026-06. Once 20260707091000 drops the min_spend_pence
-- columns, the min-spend branch can no longer parse on full-chain replays —
-- so it only runs while the column still exists (fresh databases mid-chain).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loyalty_cards'
      and column_name = 'min_spend_pence'
  ) then
    update public.reward_events
    set
      reward_name = coalesce(reward_events.reward_name, loyalty_cards.reward_name),
      reward_terms = coalesce(reward_events.reward_terms, loyalty_cards.reward_terms),
      min_spend_pence = coalesce(reward_events.min_spend_pence, loyalty_cards.min_spend_pence),
      redeemable_from = coalesce(reward_events.redeemable_from, public.next_uk_business_date(reward_events.created_at))
    from public.loyalty_cards
    where loyalty_cards.id = reward_events.loyalty_card_id;
  else
    update public.reward_events
    set
      reward_name = coalesce(reward_events.reward_name, loyalty_cards.reward_name),
      reward_terms = coalesce(reward_events.reward_terms, loyalty_cards.reward_terms),
      redeemable_from = coalesce(reward_events.redeemable_from, public.next_uk_business_date(reward_events.created_at))
    from public.loyalty_cards
    where loyalty_cards.id = reward_events.loyalty_card_id;
  end if;
end
$$;

alter table public.reward_events
  alter column reward_name set not null,
  alter column reward_terms set not null;

create index if not exists reward_pool_items_card_order_idx
  on public.reward_pool_items (merchant_id, location_id, loyalty_card_id, display_order, created_at);
create index if not exists reward_pool_items_active_idx
  on public.reward_pool_items (loyalty_card_id)
  where is_active;
create index if not exists reward_events_reward_pool_item_id_idx
  on public.reward_events (reward_pool_item_id)
  where reward_pool_item_id is not null;
create index if not exists reward_events_redeemable_from_idx
  on public.reward_events (redeemable_from)
  where status = 'unlocked';
create unique index if not exists stamp_events_one_earned_per_business_day_idx
  on public.stamp_events (membership_id, location_id, earned_business_date)
  where event_type = 'earned' and earned_business_date is not null;
create unique index if not exists qr_codes_one_active_join_per_location_idx
  on public.qr_codes (merchant_id, location_id)
  where is_active and destination_type = 'join';

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'reward_pool_items_set_updated_at'
  ) then
    create trigger reward_pool_items_set_updated_at
      before update on public.reward_pool_items
      for each row execute function public.set_updated_at();
  end if;
end $$;

create or replace function public.save_loyalty_card(
  p_merchant_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_stamps_required integer,
  p_reward_name text,
  p_reward_terms text,
  p_min_spend_pence integer,
  p_is_active boolean
)
returns table (loyalty_card_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  existing_card_id uuid;
  existing_active_card_id uuid;
  v_reward_name text := coalesce(nullif(trim(p_reward_name), ''), 'Surprise reward');
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.merchants
    where merchants.id = p_merchant_id
      and merchants.owner_user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Merchant location is required before creating a loyalty card';
  end if;

  if p_card_id is not null then
    select loyalty_cards.id
    into existing_card_id
    from public.loyalty_cards
    where loyalty_cards.id = p_card_id
      and loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id;

    if existing_card_id is null then
      raise insufficient_privilege using message = 'Loyalty card not found for merchant';
    end if;
  else
    select loyalty_cards.id
    into existing_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
    order by loyalty_cards.is_active desc, loyalty_cards.created_at asc
    limit 1;
  end if;

  if p_is_active then
    select loyalty_cards.id
    into existing_active_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
      and loyalty_cards.is_active
      and (existing_card_id is null or loyalty_cards.id <> existing_card_id)
    limit 1;

    if existing_active_card_id is not null then
      raise exception 'Only one active loyalty card is allowed for this location';
    end if;
  end if;

  if existing_card_id is null then
    insert into public.loyalty_cards (
      merchant_id,
      location_id,
      card_name,
      stamps_required,
      reward_name,
      reward_terms,
      min_spend_pence,
      is_active
    )
    values (
      p_merchant_id,
      v_location_id,
      p_card_name,
      p_stamps_required,
      v_reward_name,
      p_reward_terms,
      p_min_spend_pence,
      p_is_active
    )
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_created';
  else
    update public.loyalty_cards
    set
      card_name = p_card_name,
      stamps_required = p_stamps_required,
      reward_name = v_reward_name,
      reward_terms = p_reward_terms,
      min_spend_pence = p_min_spend_pence,
      is_active = p_is_active
    where loyalty_cards.id = existing_card_id
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_updated';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('loyalty_card_id', loyalty_card_id, 'is_active', p_is_active)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'loyalty_cards',
    loyalty_card_id,
    saved_action,
    jsonb_build_object('stamps_required', p_stamps_required, 'reward_name', v_reward_name)
  );

  return next;
end;
$$;

create or replace function public.upsert_reward_pool_item(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_reward_pool_item_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_min_spend_pence integer,
  p_weight integer,
  p_is_active boolean,
  p_display_order integer
)
returns table (reward_pool_item_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select loyalty_cards.location_id
  into v_location_id
  from public.loyalty_cards
  where loyalty_cards.id = p_loyalty_card_id
    and loyalty_cards.merchant_id = p_merchant_id;

  if v_location_id is null then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  if p_reward_pool_item_id is not null and not exists (
    select 1
    from public.reward_pool_items
    where reward_pool_items.id = p_reward_pool_item_id
      and reward_pool_items.merchant_id = p_merchant_id
      and reward_pool_items.loyalty_card_id = p_loyalty_card_id
  ) then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  if p_reward_pool_item_id is null then
    insert into public.reward_pool_items (
      merchant_id,
      location_id,
      loyalty_card_id,
      reward_name,
      reward_terms,
      min_spend_pence,
      weight,
      is_active,
      display_order
    )
    values (
      p_merchant_id,
      v_location_id,
      p_loyalty_card_id,
      trim(p_reward_name),
      trim(p_reward_terms),
      p_min_spend_pence,
      p_weight,
      p_is_active,
      p_display_order
    )
    returning id into reward_pool_item_id;

    saved_action := 'reward_pool_item_created';
  else
    update public.reward_pool_items
    set
      reward_name = trim(p_reward_name),
      reward_terms = trim(p_reward_terms),
      min_spend_pence = p_min_spend_pence,
      weight = p_weight,
      is_active = p_is_active,
      display_order = p_display_order
    where reward_pool_items.id = p_reward_pool_item_id
    returning id into reward_pool_item_id;

    saved_action := 'reward_pool_item_updated';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object(
      'loyalty_card_id', p_loyalty_card_id,
      'reward_pool_item_id', reward_pool_item_id,
      'is_active', p_is_active,
      'weight', p_weight
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'reward_pool_items',
    reward_pool_item_id,
    saved_action,
    jsonb_build_object('loyalty_card_id', p_loyalty_card_id)
  );

  return next;
end;
$$;

create or replace function public.delete_reward_pool_item(
  p_merchant_id uuid,
  p_reward_pool_item_id uuid
)
returns table (reward_pool_item_id uuid, deleted boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  if not exists (
    select 1
    from public.reward_pool_items
    where reward_pool_items.id = p_reward_pool_item_id
      and reward_pool_items.merchant_id = p_merchant_id
  ) then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  reward_pool_item_id := p_reward_pool_item_id;

  if exists (
    select 1
    from public.reward_events
    where reward_events.reward_pool_item_id = p_reward_pool_item_id
  ) then
    update public.reward_pool_items
    set is_active = false
    where reward_pool_items.id = p_reward_pool_item_id;

    deleted := false;
  else
    delete from public.reward_pool_items
    where reward_pool_items.id = p_reward_pool_item_id;

    deleted := true;
  end if;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'reward_pool_items',
    p_reward_pool_item_id,
    case when deleted then 'reward_pool_item_deleted' else 'reward_pool_item_archived' end,
    jsonb_build_object('deleted', deleted)
  );

  return next;
end;
$$;

create or replace function public.create_or_get_join_qr(
  p_merchant_id uuid,
  p_loyalty_card_id uuid
)
returns table (qr_code_uuid uuid, qr_public_id text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_location_id uuid;
  generated_qr_id text;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select loyalty_cards.location_id
  into v_location_id
  from public.loyalty_cards
  join public.merchants on merchants.id = loyalty_cards.merchant_id
  where loyalty_cards.id = p_loyalty_card_id
    and loyalty_cards.merchant_id = p_merchant_id
    and loyalty_cards.is_active
    and merchants.owner_user_id = (select auth.uid());

  if v_location_id is null then
    raise insufficient_privilege using message = 'An active loyalty card owned by this merchant is required';
  end if;

  if not exists (
    select 1
    from public.reward_pool_items
    where reward_pool_items.merchant_id = p_merchant_id
      and reward_pool_items.location_id = v_location_id
      and reward_pool_items.loyalty_card_id = p_loyalty_card_id
      and reward_pool_items.is_active
  ) then
    raise exception 'Add at least one active mystery reward before launching the QR.';
  end if;

  select qr_codes.id, qr_codes.qr_id
  into qr_code_uuid, qr_public_id
  from public.qr_codes
  where qr_codes.merchant_id = p_merchant_id
    and qr_codes.location_id = v_location_id
    and qr_codes.destination_type = 'join'
    and qr_codes.is_active
  order by qr_codes.created_at asc
  limit 1;

  if qr_code_uuid is not null then
    update public.qr_codes
    set loyalty_card_id = p_loyalty_card_id
    where qr_codes.id = qr_code_uuid
      and qr_codes.loyalty_card_id <> p_loyalty_card_id;

    return next;
    return;
  end if;

  loop
    generated_qr_id := lower(
      replace(
        replace(
          rtrim(encode(extensions.gen_random_bytes(9), 'base64'), '='),
          '+',
          '-'
        ),
        '/',
        '_'
      )
    );

    begin
      insert into public.qr_codes (
        qr_id,
        merchant_id,
        location_id,
        loyalty_card_id,
        destination_type,
        is_active
      )
      values (
        generated_qr_id,
        p_merchant_id,
        v_location_id,
        p_loyalty_card_id,
        'join',
        true
      )
      returning id, qr_id into qr_code_uuid, qr_public_id;

      exit;
    exception
      when unique_violation then
        select qr_codes.id, qr_codes.qr_id
        into qr_code_uuid, qr_public_id
        from public.qr_codes
        where qr_codes.merchant_id = p_merchant_id
          and qr_codes.location_id = v_location_id
          and qr_codes.destination_type = 'join'
          and qr_codes.is_active
        limit 1;

        if qr_code_uuid is not null then
          exit;
        end if;
    end;
  end loop;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'qr_created',
    p_merchant_id,
    qr_code_uuid,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('destination_type', 'join')
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'qr_codes',
    qr_code_uuid,
    'qr_created',
    jsonb_build_object('qr_id', qr_public_id)
  );

  return next;
end;
$$;

create or replace function public.issue_stamp_with_staff_pin(
  p_membership_id uuid,
  p_pin text
)
returns table (new_stamp_count integer, reward_unlocked boolean)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  membership_record record;
  card_record record;
  staff_record record;
  reward_pool_record record;
  billing_status text;
  failed_attempt_count integer;
  recent_stamp_count integer;
  v_business_date date := public.uk_business_date(now());
  v_total_weight integer;
  v_weight_threshold integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.current_stamp_count,
    customers.auth_user_id,
    merchants.status as merchant_status
  into membership_record
  from public.customer_memberships memberships
  join public.customers customers on customers.id = memberships.customer_id
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.id = p_membership_id
  for update of memberships;

  if membership_record.id is null then
    raise insufficient_privilege using message = 'Membership not found';
  end if;

  if membership_record.auth_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if membership_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = membership_record.merchant_id;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  select
    loyalty_cards.id,
    loyalty_cards.location_id,
    loyalty_cards.stamps_required
  into card_record
  from public.loyalty_cards
  where loyalty_cards.merchant_id = membership_record.merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if card_record.id is null then
    raise exception 'This loyalty card is not active';
  end if;

  if membership_record.current_stamp_count >= card_record.stamps_required then
    raise exception 'A reward is already ready to redeem';
  end if;

  if exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = p_membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = v_business_date
  ) then
    raise exception 'Stamp already issued for this UK business day';
  end if;

  if membership_record.current_stamp_count + 1 >= card_record.stamps_required then
    select coalesce(sum(reward_pool_items.weight), 0)
    into v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = membership_record.merchant_id
      and reward_pool_items.location_id = card_record.location_id
      and reward_pool_items.loyalty_card_id = card_record.id
      and reward_pool_items.is_active;

    if v_total_weight <= 0 then
      raise exception 'At least one active reward pool item is required before unlocking a reward';
    end if;
  end if;

  select count(*)
  into failed_attempt_count
  from public.staff_pin_attempts
  where staff_pin_attempts.merchant_id = membership_record.merchant_id
    and staff_pin_attempts.membership_id = p_membership_id
    and not staff_pin_attempts.success
    and staff_pin_attempts.created_at > now() - interval '10 minutes';

  if failed_attempt_count >= 3 then
    raise exception 'Too many incorrect PIN attempts. Try again later';
  end if;

  select staff_users.id
  into staff_record
  from public.staff_users
  where staff_users.merchant_id = membership_record.merchant_id
    and staff_users.is_active
    and staff_users.pin_hash = extensions.crypt(p_pin, staff_users.pin_hash)
  limit 1;

  if staff_record.id is null then
    insert into public.staff_pin_attempts (
      merchant_id,
      membership_id,
      success
    )
    values (
      membership_record.merchant_id,
      p_membership_id,
      false
    );

    raise insufficient_privilege using message = 'Staff PIN was not accepted';
  end if;

  insert into public.staff_pin_attempts (
    merchant_id,
    membership_id,
    success
  )
  values (
    membership_record.merchant_id,
    p_membership_id,
    true
  );

  insert into public.stamp_events (
    merchant_id,
    customer_id,
    membership_id,
    loyalty_card_id,
    location_id,
    event_type,
    stamps_delta,
    approved_by_staff_id,
    earned_business_date
  )
  values (
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    card_record.id,
    card_record.location_id,
    'earned',
    1,
    staff_record.id,
    v_business_date
  );

  update public.customer_memberships
  set
    current_stamp_count = current_stamp_count + 1,
    total_stamps_earned = total_stamps_earned + 1,
    last_visit_at = now()
  where customer_memberships.id = p_membership_id
  returning current_stamp_count into new_stamp_count;

  reward_unlocked := new_stamp_count >= card_record.stamps_required;

  if reward_unlocked then
    v_weight_threshold := floor(random() * v_total_weight)::integer + 1;

    select *
    into reward_pool_record
    from (
      select
        reward_pool_items.*,
        sum(reward_pool_items.weight) over (
          order by reward_pool_items.display_order asc,
            reward_pool_items.created_at asc,
            reward_pool_items.id asc
        ) as running_weight
      from public.reward_pool_items
      where reward_pool_items.merchant_id = membership_record.merchant_id
        and reward_pool_items.location_id = card_record.location_id
        and reward_pool_items.loyalty_card_id = card_record.id
        and reward_pool_items.is_active
    ) weighted_items
    where weighted_items.running_weight >= v_weight_threshold
    order by weighted_items.running_weight asc
    limit 1;

    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      reward_pool_item_id,
      reward_name,
      reward_terms,
      min_spend_pence,
      redeemable_from,
      status
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      card_record.id,
      reward_pool_record.id,
      reward_pool_record.reward_name,
      reward_pool_record.reward_terms,
      reward_pool_record.min_spend_pence,
      public.next_uk_business_date(now()),
      'unlocked'
    );

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
      'reward_unlocked',
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'system',
      null,
      jsonb_build_object(
        'loyalty_card_id', card_record.id,
        'reward_pool_item_id', reward_pool_record.id
      )
    );
  end if;

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
    'stamp_issued',
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    'staff',
    staff_record.id::text,
    jsonb_build_object('new_stamp_count', new_stamp_count, 'business_date', v_business_date)
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
    'staff',
    staff_record.id::text,
    membership_record.merchant_id,
    membership_record.customer_id,
    'customer_memberships',
    p_membership_id,
    'stamp_issued',
    jsonb_build_object('new_stamp_count', new_stamp_count, 'business_date', v_business_date)
  );

  select count(*)
  into recent_stamp_count
  from public.stamp_events
  where stamp_events.merchant_id = membership_record.merchant_id
    and stamp_events.event_type = 'earned'
    and stamp_events.created_at > now() - interval '15 minutes';

  if recent_stamp_count >= 20 and not exists (
    select 1
    from public.fraud_flags
    where fraud_flags.merchant_id = membership_record.merchant_id
      and fraud_flags.signal = 'high_stamp_velocity'
      and fraud_flags.status = 'open'
      and fraud_flags.created_at > now() - interval '15 minutes'
  ) then
    insert into public.fraud_flags (
      merchant_id,
      customer_id,
      membership_id,
      signal,
      severity,
      metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'high_stamp_velocity',
      'medium',
      jsonb_build_object(
        'threshold', 20,
        'window_minutes', 15,
        'observed_stamp_count', recent_stamp_count
      )
    );
  end if;

  return next;
end;
$$;

create or replace function public.redeem_reward_with_staff_pin(
  p_reward_id uuid,
  p_pin text
)
returns table (membership_id uuid, new_stamp_count integer)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  reward_record record;
  staff_record record;
  billing_status text;
  failed_attempt_count integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id,
    reward_events.loyalty_card_id,
    reward_events.reward_name,
    reward_events.reward_terms,
    reward_events.redeemable_from,
    customers.auth_user_id,
    merchants.status as merchant_status,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    customer_memberships.current_stamp_count
  into reward_record
  from public.reward_events
  join public.customer_memberships customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers customers on customers.id = reward_events.customer_id
  join public.merchants merchants on merchants.id = reward_events.merchant_id
  join public.loyalty_cards loyalty_cards on loyalty_cards.id = reward_events.loyalty_card_id
  where reward_events.id = p_reward_id
  for update of reward_events;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  membership_id := reward_record.membership_id;

  if reward_record.auth_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if reward_record.status = 'redeemed' then
    raise exception 'Reward already redeemed';
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

  if billing_status = 'suspended' then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  select count(*)
  into failed_attempt_count
  from public.staff_pin_attempts
  where staff_pin_attempts.merchant_id = reward_record.merchant_id
    and staff_pin_attempts.membership_id = reward_record.membership_id
    and not staff_pin_attempts.success
    and staff_pin_attempts.created_at > now() - interval '10 minutes';

  if failed_attempt_count >= 3 then
    raise exception 'Too many incorrect PIN attempts. Try again later';
  end if;

  select staff_users.id
  into staff_record
  from public.staff_users
  where staff_users.merchant_id = reward_record.merchant_id
    and staff_users.is_active
    and staff_users.pin_hash = extensions.crypt(p_pin, staff_users.pin_hash)
  limit 1;

  if staff_record.id is null then
    insert into public.staff_pin_attempts (
      merchant_id,
      membership_id,
      success
    )
    values (
      reward_record.merchant_id,
      reward_record.membership_id,
      false
    );

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
      'reward_redemption_failed',
      reward_record.merchant_id,
      reward_record.customer_id,
      reward_record.membership_id,
      'customer',
      (select auth.uid())::text,
      jsonb_build_object('reward_id', p_reward_id, 'reason', 'invalid_pin')
    );

    raise insufficient_privilege using message = 'Staff PIN was not accepted';
  end if;

  insert into public.staff_pin_attempts (
    merchant_id,
    membership_id,
    success
  )
  values (
    reward_record.merchant_id,
    reward_record.membership_id,
    true
  );

  update public.reward_events
  set
    status = 'redeemed',
    redeemed_by_staff_id = staff_record.id,
    redeemed_at = now(),
    metadata = reward_events.metadata || jsonb_build_object('redeemed_by', 'staff_pin')
  where reward_events.id = p_reward_id
    and reward_events.status = 'unlocked';

  if not found then
    raise exception 'Reward already redeemed';
  end if;

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
    total_rewards_redeemed = total_rewards_redeemed + 1
  where customer_memberships.id = reward_record.membership_id
  returning current_stamp_count into new_stamp_count;

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
    reward_record.membership_id,
    'staff',
    staff_record.id::text,
    jsonb_build_object(
      'reward_id', p_reward_id,
      'reward_name', reward_record.reward_name,
      'new_stamp_count', new_stamp_count
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
    'staff',
    staff_record.id::text,
    reward_record.merchant_id,
    reward_record.customer_id,
    'reward_events',
    p_reward_id,
    'reward_redeemed',
    jsonb_build_object('new_stamp_count', new_stamp_count)
  );

  return next;
end;
$$;

grant select, insert, update, delete on public.reward_pool_items to authenticated, service_role;
grant execute on function public.uk_business_date(timestamptz) to authenticated, service_role;
grant execute on function public.next_uk_business_date(timestamptz) to authenticated, service_role;
grant execute on function public.upsert_reward_pool_item(uuid, uuid, uuid, text, text, integer, integer, boolean, integer) to authenticated, service_role;
grant execute on function public.delete_reward_pool_item(uuid, uuid) to authenticated, service_role;
grant execute on function public.save_loyalty_card(uuid, uuid, text, integer, text, text, integer, boolean) to authenticated, service_role;
grant execute on function public.create_or_get_join_qr(uuid, uuid) to authenticated, service_role;
grant execute on function public.issue_stamp_with_staff_pin(uuid, text) to authenticated, service_role;
grant execute on function public.redeem_reward_with_staff_pin(uuid, text) to authenticated, service_role;

alter table public.reward_pool_items enable row level security;
alter table public.reward_pool_items force row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reward_pool_items'
      and policyname = 'reward_pool_items_select_owner_staff_admin'
  ) then
    create policy reward_pool_items_select_owner_staff_admin
      on public.reward_pool_items for select to authenticated
      using (
        (select public.is_merchant_owner(merchant_id))
        or (select public.is_staff_for_merchant(merchant_id, location_id))
        or (select public.is_internal_admin())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reward_pool_items'
      and policyname = 'reward_pool_items_insert_owner_or_admin'
  ) then
    create policy reward_pool_items_insert_owner_or_admin
      on public.reward_pool_items for insert to authenticated
      with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reward_pool_items'
      and policyname = 'reward_pool_items_update_owner_or_admin'
  ) then
    create policy reward_pool_items_update_owner_or_admin
      on public.reward_pool_items for update to authenticated
      using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()))
      with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reward_pool_items'
      and policyname = 'reward_pool_items_delete_owner_or_admin'
  ) then
    create policy reward_pool_items_delete_owner_or_admin
      on public.reward_pool_items for delete to authenticated
      using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
  end if;
end $$;

notify pgrst, 'reload schema';
