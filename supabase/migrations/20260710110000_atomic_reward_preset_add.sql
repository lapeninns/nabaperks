-- merchant reward preset atomic add
--
-- Reward-preset selection is a draft until the merchant presses Add. This RPC
-- makes that explicit action one card-locked PostgreSQL transaction: every new
-- reward and its two authoritative ledger rows commit together, or none do.

create or replace function public.assert_reward_pool_launch_ready(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  active_reward_count integer;
  has_active_join_qr boolean;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  if not exists (
    select 1
    from public.loyalty_cards as cards
    where cards.id = p_loyalty_card_id
      and cards.merchant_id = p_merchant_id
      and cards.location_id = p_location_id
  ) then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  select count(*)
  into active_reward_count
  from public.reward_pool_items
  where reward_pool_items.merchant_id = p_merchant_id
    and reward_pool_items.location_id = p_location_id
    and reward_pool_items.loyalty_card_id = p_loyalty_card_id
    and reward_pool_items.is_active;

  select exists (
    select 1
    from public.qr_codes
    where qr_codes.merchant_id = p_merchant_id
      and qr_codes.location_id = p_location_id
      and qr_codes.loyalty_card_id = p_loyalty_card_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
  )
  into has_active_join_qr;

  if has_active_join_qr and active_reward_count < 3 then
    raise exception 'Keep at least 3 active rewards before launch QR stays live.';
  end if;
end;
$function$;

create or replace function public.add_reward_pool_presets(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_presets jsonb
)
returns table (
  preset_id text,
  reward_pool_item_id uuid,
  reward_name text,
  reward_terms text,
  weight integer,
  is_active boolean,
  display_order integer,
  saved_action text,
  active_reward_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $function$
#variable_conflict use_column
declare
  v_actor_id uuid;
  v_location_id uuid;
  v_preset_count integer;
  v_next_display_order integer;
  v_final_active_count integer;
  v_preset jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_preset_id text;
  v_reward_name text;
  v_reward_terms text;
  v_reward_name_key text;
  v_item_id uuid;
  v_item_name text;
  v_item_terms text;
  v_item_weight integer;
  v_item_active boolean;
  v_item_display_order integer;
  v_saved_action text;
  v_existing_found boolean;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  if p_presets is null or pg_catalog.jsonb_typeof(p_presets) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Batch must contain between 1 and 7 presets';
  end if;

  v_preset_count := pg_catalog.jsonb_array_length(p_presets);
  if v_preset_count < 1 or v_preset_count > 7 then
    raise exception using
      errcode = '22023',
      message = 'Batch must contain between 1 and 7 presets';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_presets) as entries(value)
    where pg_catalog.jsonb_typeof(entries.value) <> 'object'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid preset payload: preset id, name, and terms are required';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_presets) as entries(value)
    where not (
        entries.value ?& array['preset_id', 'reward_name', 'reward_terms']::text[]
      )
      or entries.value - array['preset_id', 'reward_name', 'reward_terms']::text[]
        <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(entries.value -> 'preset_id') <> 'string'
      or pg_catalog.jsonb_typeof(entries.value -> 'reward_name') <> 'string'
      or pg_catalog.jsonb_typeof(entries.value -> 'reward_terms') <> 'string'
      or pg_catalog.char_length(
        pg_catalog.regexp_replace(
          entries.value ->> 'preset_id',
          '(^[[:space:]]+|[[:space:]]+$)',
          '',
          'g'
        )
      ) not between 1 and 100
      or pg_catalog.char_length(
        pg_catalog.regexp_replace(
          entries.value ->> 'reward_name',
          '(^[[:space:]]+|[[:space:]]+$)',
          '',
          'g'
        )
      ) not between 1 and 100
      or pg_catalog.char_length(
        pg_catalog.regexp_replace(
          entries.value ->> 'reward_terms',
          '(^[[:space:]]+|[[:space:]]+$)',
          '',
          'g'
        )
      ) not between 12 and 500
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid preset payload: preset id, name, and terms are required';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_presets) as entries(value)
    group by pg_catalog.regexp_replace(
      entries.value ->> 'preset_id',
      '(^[[:space:]]+|[[:space:]]+$)',
      '',
      'g'
    )
    having count(*) > 1
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_presets) as entries(value)
    group by pg_catalog.lower(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(
          entries.value ->> 'reward_name',
          '[[:space:]]+',
          ' ',
          'g'
        )
      )
    )
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Duplicate preset ids or reward names in batch';
  end if;

  -- This is the shared same-card lock for batch add, one-item upsert, and
  -- delete. It is acquired before existing-name reads or display-order work.
  select cards.location_id
  into v_location_id
  from public.loyalty_cards as cards
  where cards.id = p_loyalty_card_id
    and cards.merchant_id = p_merchant_id
  for update of cards;

  if v_location_id is null then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  select coalesce(max(items.display_order), 0)
  into v_next_display_order
  from public.reward_pool_items as items
  where items.merchant_id = p_merchant_id
    and items.location_id = v_location_id
    and items.loyalty_card_id = p_loyalty_card_id;

  for v_preset in
    select entries.value
    from pg_catalog.jsonb_array_elements(p_presets) with ordinality as entries(value, ordinal)
    order by entries.ordinal
  loop
    v_preset_id := pg_catalog.regexp_replace(
      v_preset ->> 'preset_id',
      '(^[[:space:]]+|[[:space:]]+$)',
      '',
      'g'
    );
    v_reward_name := pg_catalog.regexp_replace(
      v_preset ->> 'reward_name',
      '(^[[:space:]]+|[[:space:]]+$)',
      '',
      'g'
    );
    v_reward_terms := pg_catalog.regexp_replace(
      v_preset ->> 'reward_terms',
      '(^[[:space:]]+|[[:space:]]+$)',
      '',
      'g'
    );
    v_reward_name_key := pg_catalog.lower(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(v_reward_name, '[[:space:]]+', ' ', 'g')
      )
    );

    select
      items.id,
      items.reward_name,
      items.reward_terms,
      items.weight,
      items.is_active,
      items.display_order
    into
      v_item_id,
      v_item_name,
      v_item_terms,
      v_item_weight,
      v_item_active,
      v_item_display_order
    from public.reward_pool_items as items
    where items.merchant_id = p_merchant_id
      and items.location_id = v_location_id
      and items.loyalty_card_id = p_loyalty_card_id
      and pg_catalog.lower(
        pg_catalog.btrim(
          pg_catalog.regexp_replace(
            items.reward_name,
            '[[:space:]]+',
            ' ',
            'g'
          )
        )
      ) = v_reward_name_key
    order by items.display_order, items.created_at, items.id
    limit 1;

    v_existing_found := found;

    if v_existing_found then
      v_saved_action := 'reward_pool_item_existing';
    else
      v_next_display_order := v_next_display_order + 1;

      insert into public.reward_pool_items (
        merchant_id,
        location_id,
        loyalty_card_id,
        reward_name,
        reward_terms,
        weight,
        is_active,
        display_order
      )
      values (
        p_merchant_id,
        v_location_id,
        p_loyalty_card_id,
        v_reward_name,
        v_reward_terms,
        1,
        true,
        v_next_display_order
      )
      returning
        reward_pool_items.id,
        reward_pool_items.reward_name,
        reward_pool_items.reward_terms,
        reward_pool_items.weight,
        reward_pool_items.is_active,
        reward_pool_items.display_order
      into
        v_item_id,
        v_item_name,
        v_item_terms,
        v_item_weight,
        v_item_active,
        v_item_display_order;

      v_saved_action := 'reward_pool_item_created';

      insert into public.product_events (
        event_name,
        merchant_id,
        actor_type,
        actor_id,
        metadata
      )
      values (
        v_saved_action,
        p_merchant_id,
        'merchant',
        v_actor_id::text,
        pg_catalog.jsonb_build_object(
          'source', 'reward_preset_batch',
          'preset_id', v_preset_id,
          'loyalty_card_id', p_loyalty_card_id,
          'reward_pool_item_id', v_item_id,
          'is_active', true,
          'weight', 1
        )
      );

      -- Deliberately after the product event. A failure here proves the reward,
      -- event, and all prior batch rows roll back as one transaction.
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
        v_actor_id::text,
        p_merchant_id,
        'reward_pool_items',
        v_item_id,
        v_saved_action,
        pg_catalog.jsonb_build_object(
          'source', 'reward_preset_batch',
          'preset_id', v_preset_id,
          'loyalty_card_id', p_loyalty_card_id
        )
      );
    end if;

    v_results := v_results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'preset_id', v_preset_id,
        'reward_pool_item_id', v_item_id,
        'reward_name', v_item_name,
        'reward_terms', v_item_terms,
        'weight', v_item_weight,
        'is_active', v_item_active,
        'display_order', v_item_display_order,
        'saved_action', v_saved_action
      )
    );
  end loop;

  select count(*)::integer
  into v_final_active_count
  from public.reward_pool_items as items
  where items.merchant_id = p_merchant_id
    and items.location_id = v_location_id
    and items.loyalty_card_id = p_loyalty_card_id
    and items.is_active;

  for v_result in
    select entries.value
    from pg_catalog.jsonb_array_elements(v_results) with ordinality as entries(value, ordinal)
    order by entries.ordinal
  loop
    preset_id := v_result ->> 'preset_id';
    reward_pool_item_id := (v_result ->> 'reward_pool_item_id')::uuid;
    reward_name := v_result ->> 'reward_name';
    reward_terms := v_result ->> 'reward_terms';
    weight := (v_result ->> 'weight')::integer;
    is_active := (v_result ->> 'is_active')::boolean;
    display_order := (v_result ->> 'display_order')::integer;
    saved_action := v_result ->> 'saved_action';
    active_reward_count := v_final_active_count;
    return next;
  end loop;
end;
$function$;

-- Preserve the existing one-item API while putting it behind the same card
-- lock and normalized-name invariant as the batch path.
create or replace function public.upsert_reward_pool_item(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_reward_pool_item_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_weight integer,
  p_is_active boolean,
  p_display_order integer
)
returns table (reward_pool_item_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $function$
#variable_conflict use_column
declare
  v_location_id uuid;
  v_reward_name text;
  v_reward_terms text;
  v_reward_name_key text;
  v_current_reward_name_key text;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select cards.location_id
  into v_location_id
  from public.loyalty_cards as cards
  where cards.id = p_loyalty_card_id
    and cards.merchant_id = p_merchant_id
  for update of cards;

  if v_location_id is null then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  if p_reward_pool_item_id is not null then
    select pg_catalog.lower(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(
          items.reward_name,
          '[[:space:]]+',
          ' ',
          'g'
        )
      )
    )
    into v_current_reward_name_key
    from public.reward_pool_items as items
    where items.id = p_reward_pool_item_id
      and items.merchant_id = p_merchant_id
      and items.location_id = v_location_id
      and items.loyalty_card_id = p_loyalty_card_id;

    if not found then
      raise insufficient_privilege using message = 'Reward pool item not found for merchant';
    end if;
  end if;

  v_reward_name := pg_catalog.regexp_replace(
    coalesce(p_reward_name, ''),
    '(^[[:space:]]+|[[:space:]]+$)',
    '',
    'g'
  );
  v_reward_terms := pg_catalog.regexp_replace(
    coalesce(p_reward_terms, ''),
    '(^[[:space:]]+|[[:space:]]+$)',
    '',
    'g'
  );
  v_reward_name_key := pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(v_reward_name, '[[:space:]]+', ' ', 'g')
    )
  );

  -- Historical duplicate rows are not rewritten by this migration. An update
  -- that keeps its current normalized name (for example an active toggle) may
  -- continue; only a new item or an actual rename is collision-checked.
  if (
    p_reward_pool_item_id is null
    or v_reward_name_key is distinct from v_current_reward_name_key
  ) and exists (
    select 1
    from public.reward_pool_items as items
    where items.merchant_id = p_merchant_id
      and items.location_id = v_location_id
      and items.loyalty_card_id = p_loyalty_card_id
      and (p_reward_pool_item_id is null or items.id <> p_reward_pool_item_id)
      and pg_catalog.lower(
        pg_catalog.btrim(
          pg_catalog.regexp_replace(
            items.reward_name,
            '[[:space:]]+',
            ' ',
            'g'
          )
        )
      ) = v_reward_name_key
  ) then
    raise unique_violation using message = 'Reward name already exists in this pool';
  end if;

  if p_reward_pool_item_id is null then
    insert into public.reward_pool_items (
      merchant_id,
      location_id,
      loyalty_card_id,
      reward_name,
      reward_terms,
      weight,
      is_active,
      display_order
    )
    values (
      p_merchant_id,
      v_location_id,
      p_loyalty_card_id,
      v_reward_name,
      v_reward_terms,
      p_weight,
      p_is_active,
      p_display_order
    )
    returning reward_pool_items.id into reward_pool_item_id;

    saved_action := 'reward_pool_item_created';
  else
    update public.reward_pool_items as items
    set
      reward_name = v_reward_name,
      reward_terms = v_reward_terms,
      weight = p_weight,
      is_active = p_is_active,
      display_order = p_display_order
    where items.id = p_reward_pool_item_id
    returning items.id into reward_pool_item_id;

    saved_action := 'reward_pool_item_updated';
  end if;

  perform public.assert_reward_pool_launch_ready(
    p_merchant_id,
    p_loyalty_card_id,
    v_location_id
  );

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
    pg_catalog.jsonb_build_object(
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
    pg_catalog.jsonb_build_object('loyalty_card_id', p_loyalty_card_id)
  );

  return next;
end;
$function$;

-- Deletion/archival also participates in the same lock order so simultaneous
-- changes cannot independently pass the three-active live-QR guard.
create or replace function public.delete_reward_pool_item(
  p_merchant_id uuid,
  p_reward_pool_item_id uuid
)
returns table (reward_pool_item_id uuid, deleted boolean)
language plpgsql
security definer
set search_path = public, auth
as $function$
#variable_conflict use_column
declare
  v_loyalty_card_id uuid;
  v_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select items.loyalty_card_id, items.location_id
  into v_loyalty_card_id, v_location_id
  from public.reward_pool_items as items
  where items.id = p_reward_pool_item_id
    and items.merchant_id = p_merchant_id;

  if v_loyalty_card_id is null then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  perform 1
  from public.loyalty_cards as cards
  where cards.id = v_loyalty_card_id
    and cards.merchant_id = p_merchant_id
    and cards.location_id = v_location_id
  for update of cards;

  if not found then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  -- The item may have disappeared while this call waited for the card lock.
  -- Re-read it under a fresh READ COMMITTED statement before mutating/logging.
  select items.loyalty_card_id, items.location_id
  into v_loyalty_card_id, v_location_id
  from public.reward_pool_items as items
  where items.id = p_reward_pool_item_id
    and items.merchant_id = p_merchant_id;

  if v_loyalty_card_id is null then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  reward_pool_item_id := p_reward_pool_item_id;

  if exists (
    select 1
    from public.reward_events as events
    where events.reward_pool_item_id = p_reward_pool_item_id
  ) then
    update public.reward_pool_items as items
    set is_active = false
    where items.id = p_reward_pool_item_id;

    deleted := false;
  else
    delete from public.reward_pool_items as items
    where items.id = p_reward_pool_item_id;

    deleted := true;
  end if;

  perform public.assert_reward_pool_launch_ready(
    p_merchant_id,
    v_loyalty_card_id,
    v_location_id
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
    p_reward_pool_item_id,
    case when deleted then 'reward_pool_item_deleted' else 'reward_pool_item_archived' end,
    pg_catalog.jsonb_build_object('deleted', deleted)
  );

  return next;
end;
$function$;

-- QR activation participates in the same card lock as reward mutations. The
-- trigger is the central boundary for merchant, admin, and create-or-get paths,
-- so an activation that raced a delete/deactivation must recheck after waiting.
create or replace function public.enforce_active_join_qr_reward_pool_minimum()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_active_reward_count integer;
begin
  if new.destination_type <> 'join' or new.is_active is not true then
    return new;
  end if;

  perform 1
  from public.loyalty_cards as cards
  where cards.id = new.loyalty_card_id
    and cards.merchant_id = new.merchant_id
    and cards.location_id = new.location_id
    and cards.is_active
  for update of cards;

  if not found then
    raise exception 'An active loyalty card is required before launching the QR.';
  end if;

  select count(*)::integer
  into v_active_reward_count
  from public.reward_pool_items as items
  where items.merchant_id = new.merchant_id
    and items.location_id = new.location_id
    and items.loyalty_card_id = new.loyalty_card_id
    and items.is_active;

  if v_active_reward_count < 3 then
    raise exception 'Add at least 3 active mystery rewards before launching the QR.';
  end if;

  return new;
end;
$function$;

drop trigger if exists qr_codes_guard_active_join_reward_pool on public.qr_codes;
create trigger qr_codes_guard_active_join_reward_pool
before insert or update on public.qr_codes
for each row execute function public.enforce_active_join_qr_reward_pool_minimum();

revoke all on function public.enforce_active_join_qr_reward_pool_minimum()
from public, anon, authenticated;
grant execute on function public.enforce_active_join_qr_reward_pool_minimum()
to service_role;

-- Application reward mutations must pass through the audited RPC boundary.
alter table public.reward_pool_items enable row level security;
alter table public.reward_pool_items force row level security;

revoke all on table public.reward_pool_items from public, anon;
revoke all on table public.reward_pool_items from authenticated;
grant select on table public.reward_pool_items to authenticated;
grant select, insert, update, delete on table public.reward_pool_items to service_role;

revoke all on function public.add_reward_pool_presets(uuid, uuid, jsonb) from public, anon;
revoke all on function public.assert_reward_pool_launch_ready(uuid, uuid, uuid) from public, anon;
revoke all on function public.upsert_reward_pool_item(uuid, uuid, uuid, text, text, integer, boolean, integer) from public, anon;
revoke all on function public.delete_reward_pool_item(uuid, uuid) from public, anon;

grant execute on function public.add_reward_pool_presets(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.assert_reward_pool_launch_ready(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.upsert_reward_pool_item(uuid, uuid, uuid, text, text, integer, boolean, integer) to authenticated, service_role;
grant execute on function public.delete_reward_pool_item(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
