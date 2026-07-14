-- Replay guard (db staff excision): staff_users is dropped at the end of
-- the chain and its creator (the skipped initial migration) never re-adds it.
do $$
begin
  if to_regclass('public.staff_users') is not null then
    alter table public.staff_users
      add column if not exists pin_ciphertext text;
  end if;
end
$$;

drop function if exists public.get_merchant_staff_pin_status(uuid);

create or replace function public.get_merchant_staff_pin_status(
  p_merchant_id uuid
)
returns table (
  configured boolean,
  display_name text,
  updated_at timestamptz,
  reveal_available boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  v_staff_record record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    configured := false;
    display_name := null;
    updated_at := null;
    reveal_available := false;
    return next;
    return;
  end if;

  select staff_users.display_name, staff_users.updated_at, staff_users.pin_ciphertext
  into v_staff_record
  from public.staff_users
  where staff_users.merchant_id = p_merchant_id
    and staff_users.location_id = v_location_id
    and staff_users.is_active
  order by staff_users.updated_at desc
  limit 1;

  configured := v_staff_record.display_name is not null;
  display_name := v_staff_record.display_name;
  updated_at := v_staff_record.updated_at;
  reveal_available := v_staff_record.pin_ciphertext is not null;
  return next;
end;
$$;

drop function if exists public.upsert_merchant_staff_pin(uuid, text, text);

create or replace function public.upsert_merchant_staff_pin(
  p_merchant_id uuid,
  p_pin text,
  p_display_name text default 'Counter staff',
  p_pin_ciphertext text default null
)
returns table (configured boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_location_id uuid;
  v_staff_id uuid;
  v_action text;
  v_display_name text := coalesce(nullif(trim(p_display_name), ''), 'Counter staff');
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  if p_pin is null or p_pin !~ '^\d{4,12}$' then
    raise exception 'PIN must be 4 to 12 digits';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Merchant location is required before setting a staff PIN';
  end if;

  select staff_users.id
  into v_staff_id
  from public.staff_users
  where staff_users.merchant_id = p_merchant_id
    and staff_users.location_id = v_location_id
    and staff_users.is_active
  order by staff_users.updated_at desc
  limit 1;

  if v_staff_id is null then
    insert into public.staff_users (
      merchant_id,
      location_id,
      auth_user_id,
      display_name,
      role,
      pin_hash,
      pin_ciphertext,
      is_active
    )
    values (
      p_merchant_id,
      v_location_id,
      null,
      v_display_name,
      'staff',
      extensions.crypt(p_pin, extensions.gen_salt('bf')),
      p_pin_ciphertext,
      true
    )
    returning id, staff_users.updated_at into v_staff_id, updated_at;

    v_action := 'staff_pin_set';
  else
    update public.staff_users
    set
      display_name = v_display_name,
      pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      pin_ciphertext = p_pin_ciphertext,
      is_active = true
    where staff_users.id = v_staff_id
    returning staff_users.updated_at into updated_at;

    v_action := 'staff_pin_changed';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    v_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('staff_user_id', v_staff_id, 'location_id', v_location_id)
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
    'staff_users',
    v_staff_id,
    v_action,
    jsonb_build_object('location_id', v_location_id)
  );

  configured := true;
  return next;
end;
$$;

create or replace function public.get_merchant_staff_pin_ciphertext(
  p_merchant_id uuid
)
returns table (
  configured boolean,
  staff_user_id uuid,
  location_id uuid,
  pin_ciphertext text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  v_staff_record record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    configured := false;
    staff_user_id := null;
    location_id := null;
    pin_ciphertext := null;
    return next;
    return;
  end if;

  select staff_users.id, staff_users.pin_ciphertext
  into v_staff_record
  from public.staff_users
  where staff_users.merchant_id = p_merchant_id
    and staff_users.location_id = v_location_id
    and staff_users.is_active
  order by staff_users.updated_at desc
  limit 1;

  configured := v_staff_record.id is not null;
  staff_user_id := v_staff_record.id;
  location_id := v_location_id;
  pin_ciphertext := v_staff_record.pin_ciphertext;
  return next;
end;
$$;

grant execute on function public.get_merchant_staff_pin_status(uuid) to authenticated, service_role;
grant execute on function public.upsert_merchant_staff_pin(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.get_merchant_staff_pin_ciphertext(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
