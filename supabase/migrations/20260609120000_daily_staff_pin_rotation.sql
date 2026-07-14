-- Replay guard (db staff excision): staff_users is dropped at the end of
-- the chain and its creator (the skipped initial migration) never re-adds it.
do $$
begin
  if to_regclass('public.staff_users') is not null then
    alter table public.staff_users
      add column if not exists pin_rotated_on date;
    create index if not exists staff_users_pin_rotation_idx
      on public.staff_users (pin_rotated_on, updated_at desc)
      where is_active;
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
  reveal_available boolean,
  pin_rotated_on date
)
language plpgsql
security definer
set search_path = public, auth, extensions
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
    pin_rotated_on := null;
    return next;
    return;
  end if;

  select
    staff_users.display_name,
    staff_users.updated_at,
    staff_users.pin_ciphertext,
    staff_users.pin_rotated_on
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
  pin_rotated_on := v_staff_record.pin_rotated_on;
  return next;
end;
$$;

create or replace function public.rotate_staff_pin_system(
  p_staff_user_id uuid,
  p_pin text,
  p_pin_ciphertext text,
  p_rotation_date date
)
returns table (rotated boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_staff_record record;
begin
  if p_pin is null or p_pin !~ '^\d{4,12}$' then
    raise exception 'PIN must be 4 to 12 digits';
  end if;

  if p_pin_ciphertext is null or length(trim(p_pin_ciphertext)) = 0 then
    raise exception 'Encrypted PIN ciphertext is required';
  end if;

  select staff_users.id, staff_users.merchant_id, staff_users.location_id, staff_users.pin_rotated_on
  into v_staff_record
  from public.staff_users
  where staff_users.id = p_staff_user_id
    and staff_users.is_active
  for update;

  if v_staff_record.id is null then
    rotated := false;
    updated_at := null;
    return next;
    return;
  end if;

  if v_staff_record.pin_rotated_on = p_rotation_date then
    rotated := false;
    select staff_users.updated_at
    into updated_at
    from public.staff_users
    where staff_users.id = p_staff_user_id;
    return next;
    return;
  end if;

  update public.staff_users
  set
    pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
    pin_ciphertext = p_pin_ciphertext,
    pin_rotated_on = p_rotation_date,
    is_active = true
  where staff_users.id = p_staff_user_id
  returning staff_users.updated_at into updated_at;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'staff_pin_rotated',
    v_staff_record.merchant_id,
    'system',
    'daily_staff_pin_rotation',
    jsonb_build_object(
      'staff_user_id', p_staff_user_id,
      'location_id', v_staff_record.location_id,
      'rotation_date', p_rotation_date
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
    'system',
    'daily_staff_pin_rotation',
    v_staff_record.merchant_id,
    'staff_users',
    p_staff_user_id,
    'staff_pin_rotated',
    jsonb_build_object(
      'location_id', v_staff_record.location_id,
      'rotation_date', p_rotation_date
    )
  );

  rotated := true;
  return next;
end;
$$;

revoke execute on function public.rotate_staff_pin_system(uuid, text, text, date) from anon, authenticated;
grant execute on function public.rotate_staff_pin_system(uuid, text, text, date) to service_role;
grant execute on function public.get_merchant_staff_pin_status(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
