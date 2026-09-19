-- Venue collection windows and closures.
--
-- WHAT CHANGES
--   * Owners can configure optional quiet-time upgrade windows. Windows are a
--     bonus only: they never gate ordinary reward collection.
--   * Owners can record bounded, non-overlapping venue closures.
--   * Both resources are tenant scoped, forced-RLS tables. Direct API writes
--     are withheld; security-definer RPCs own validation, locking and audit.
--
-- Forward-only and re-runnable.

-- 1. Tenant-safe tables ---------------------------------------------------------

do $block$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reward_pool_items'::regclass
      and conname = 'reward_pool_items_merchant_location_id_key'
  ) then
    alter table public.reward_pool_items
      add constraint reward_pool_items_merchant_location_id_key
      unique (merchant_id, location_id, id);
  end if;
end
$block$;

create table if not exists public.venue_collection_windows (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid not null references public.merchant_locations(id) on delete cascade,
  isodow smallint not null,
  starts_at time without time zone not null,
  ends_at time without time zone not null,
  upgrade_pool_item_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_collection_windows_isodow_check
    check (isodow between 1 and 7) not valid,
  constraint venue_collection_windows_range_check
    check (starts_at < ends_at and ends_at - starts_at >= interval '30 minutes') not valid,
  constraint venue_collection_windows_location_matches_merchant
    foreign key (merchant_id, location_id)
    references public.merchant_locations(merchant_id, id)
    on delete cascade
    deferrable initially immediate,
  constraint venue_collection_windows_upgrade_matches_location
    foreign key (merchant_id, location_id, upgrade_pool_item_id)
    references public.reward_pool_items(merchant_id, location_id, id)
    on delete set null (upgrade_pool_item_id)
    deferrable initially immediate
);

alter table public.venue_collection_windows
  validate constraint venue_collection_windows_isodow_check;
alter table public.venue_collection_windows
  validate constraint venue_collection_windows_range_check;

create table if not exists public.venue_closures (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid not null references public.merchant_locations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  ended_early_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_closures_range_check
    check (starts_at < ends_at and ends_at - starts_at <= interval '90 days') not valid,
  constraint venue_closures_reason_check
    check (length(trim(reason)) between 1 and 200) not valid,
  constraint venue_closures_early_end_check
    check (ended_early_at is null or ended_early_at > starts_at) not valid,
  constraint venue_closures_location_matches_merchant
    foreign key (merchant_id, location_id)
    references public.merchant_locations(merchant_id, id)
    on delete cascade
    deferrable initially immediate
);

alter table public.venue_closures validate constraint venue_closures_range_check;
alter table public.venue_closures validate constraint venue_closures_reason_check;
alter table public.venue_closures validate constraint venue_closures_early_end_check;

create unique index if not exists venue_collection_windows_active_start_idx
  on public.venue_collection_windows (location_id, isodow, starts_at)
  where is_active;
create index if not exists venue_collection_windows_active_lookup_idx
  on public.venue_collection_windows (location_id, isodow, starts_at, ends_at)
  where is_active;
create index if not exists venue_collection_windows_upgrade_item_idx
  on public.venue_collection_windows (upgrade_pool_item_id)
  where upgrade_pool_item_id is not null;
create index if not exists venue_closures_location_range_idx
  on public.venue_closures (location_id, starts_at, ends_at);

drop trigger if exists venue_collection_windows_set_updated_at
  on public.venue_collection_windows;
create trigger venue_collection_windows_set_updated_at
  before update on public.venue_collection_windows
  for each row execute function public.set_updated_at();

drop trigger if exists venue_closures_set_updated_at on public.venue_closures;
create trigger venue_closures_set_updated_at
  before update on public.venue_closures
  for each row execute function public.set_updated_at();

-- 2. RLS and table privileges ---------------------------------------------------

alter table public.venue_collection_windows enable row level security;
alter table public.venue_collection_windows force row level security;
alter table public.venue_closures enable row level security;
alter table public.venue_closures force row level security;

drop policy if exists venue_collection_windows_select_owner_or_admin
  on public.venue_collection_windows;
create policy venue_collection_windows_select_owner_or_admin
  on public.venue_collection_windows
  for select to authenticated
  using (
    merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

drop policy if exists venue_closures_select_owner_or_admin
  on public.venue_closures;
create policy venue_closures_select_owner_or_admin
  on public.venue_closures
  for select to authenticated
  using (
    merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

revoke all on table public.venue_collection_windows from public, anon, authenticated, service_role;
revoke all on table public.venue_closures from public, anon, authenticated, service_role;
grant select on table public.venue_collection_windows to authenticated, service_role;
grant select on table public.venue_closures to authenticated, service_role;

-- 3. Database-level overlap guards ---------------------------------------------

create or replace function private.guard_venue_collection_window_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
begin
  if not new.is_active then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('collection-window:' || new.location_id::text || ':' || new.isodow::text, 0)
  );

  if exists (
    select 1
    from public.venue_collection_windows windows
    where windows.location_id = new.location_id
      and windows.isodow = new.isodow
      and windows.is_active
      and windows.id <> new.id
      and windows.starts_at < new.ends_at
      and new.starts_at < windows.ends_at
  ) then
    raise exception 'Collection windows cannot overlap'
      using errcode = 'NBW01';
  end if;

  return new;
end;
$function$;

drop trigger if exists venue_collection_windows_reject_overlap
  on public.venue_collection_windows;
create trigger venue_collection_windows_reject_overlap
  before insert or update of location_id, isodow, starts_at, ends_at, is_active
  on public.venue_collection_windows
  for each row execute function private.guard_venue_collection_window_overlap();

create or replace function private.guard_venue_closure_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_effective_end timestamptz := least(new.ends_at, coalesce(new.ended_early_at, new.ends_at));
begin
  perform pg_advisory_xact_lock(
    hashtextextended('venue-closure:' || new.location_id::text, 0)
  );

  if exists (
    select 1
    from public.venue_closures closures
    where closures.location_id = new.location_id
      and closures.id <> new.id
      and closures.starts_at < v_effective_end
      and new.starts_at < least(closures.ends_at, coalesce(closures.ended_early_at, closures.ends_at))
  ) then
    raise exception 'Venue closures cannot overlap'
      using errcode = 'NBW06';
  end if;

  return new;
end;
$function$;

drop trigger if exists venue_closures_reject_overlap on public.venue_closures;
create trigger venue_closures_reject_overlap
  before insert or update of location_id, starts_at, ends_at, ended_early_at
  on public.venue_closures
  for each row execute function private.guard_venue_closure_overlap();

-- 4. Owner/admin management RPCs -----------------------------------------------

create or replace function public.save_venue_collection_windows(
  p_merchant_id uuid,
  p_location_id uuid,
  p_windows jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_entry jsonb;
  v_isodow smallint;
  v_starts_at time;
  v_ends_at time;
  v_upgrade_pool_item_id uuid;
  v_is_active boolean;
  v_window_id uuid;
begin
  if p_merchant_id is null
     or not (public.is_merchant_owner(p_merchant_id) or public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  if p_location_id is null or not exists (
    select 1 from public.merchant_locations locations
    where locations.id = p_location_id and locations.merchant_id = p_merchant_id
  ) then
    raise exception 'The collection-window location does not belong to this merchant'
      using errcode = 'NBW04';
  end if;

  if p_windows is null or jsonb_typeof(p_windows) <> 'array' then
    raise exception 'Collection windows must be a JSON array'
      using errcode = 'NBW02';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('collection-windows:' || p_location_id::text, 0)
  );

  for v_entry in select value from jsonb_array_elements(p_windows)
  loop
    begin
      if nullif(v_entry->>'location_id', '') is not null
         and (v_entry->>'location_id')::uuid <> p_location_id then
        raise exception 'Every collection window must match the scoped location'
          using errcode = 'NBW04';
      end if;
      v_isodow := nullif(v_entry->>'isodow', '')::smallint;
      v_starts_at := nullif(v_entry->>'starts_at', '')::time;
      v_ends_at := nullif(v_entry->>'ends_at', '')::time;
      v_upgrade_pool_item_id := nullif(v_entry->>'upgrade_pool_item_id', '')::uuid;
      v_is_active := coalesce(nullif(v_entry->>'is_active', '')::boolean, true);
    exception
      when invalid_text_representation
        or invalid_datetime_format
        or datetime_field_overflow
        or invalid_parameter_value then
        raise exception 'A collection window has malformed fields'
          using errcode = 'NBW02';
    end;

    if v_isodow is null or v_isodow not between 1 and 7
       or v_starts_at is null or v_ends_at is null then
      raise exception 'A collection window is missing a valid day or time'
        using errcode = 'NBW02';
    end if;
    if v_starts_at >= v_ends_at
       or v_ends_at - v_starts_at < interval '30 minutes' then
      raise exception 'Collection windows must stay within one day and last at least 30 minutes'
        using errcode = 'NBW03';
    end if;
    if v_upgrade_pool_item_id is not null and not exists (
      select 1 from public.reward_pool_items items
      where items.id = v_upgrade_pool_item_id
        and items.merchant_id = p_merchant_id
        and items.location_id = p_location_id
        and items.is_active
    ) then
      raise exception 'The upgrade reward is not active for this location'
        using errcode = 'NBW04';
    end if;
  end loop;

  begin
    if exists (
      with parsed as (
        select
          entry.ordinality,
          nullif(entry.value->>'isodow', '')::smallint as isodow,
          nullif(entry.value->>'starts_at', '')::time as starts_at,
          nullif(entry.value->>'ends_at', '')::time as ends_at,
          coalesce(nullif(entry.value->>'is_active', '')::boolean, true) as is_active
        from jsonb_array_elements(p_windows) with ordinality entry(value, ordinality)
      )
      select 1
      from parsed left_window
      join parsed right_window
        on right_window.ordinality > left_window.ordinality
       and right_window.isodow = left_window.isodow
       and left_window.is_active
       and right_window.is_active
       and left_window.starts_at < right_window.ends_at
       and right_window.starts_at < left_window.ends_at
    ) then
      raise exception 'Collection windows cannot overlap'
        using errcode = 'NBW01';
    end if;
  exception
    when invalid_text_representation
      or invalid_datetime_format
      or datetime_field_overflow
      or invalid_parameter_value then
      raise exception 'A collection window has malformed fields'
        using errcode = 'NBW02';
  end;

  update public.venue_collection_windows windows
  set is_active = false
  where windows.merchant_id = p_merchant_id
    and windows.location_id = p_location_id
    and windows.is_active;

  for v_entry in select value from jsonb_array_elements(p_windows)
  loop
    v_isodow := (v_entry->>'isodow')::smallint;
    v_starts_at := (v_entry->>'starts_at')::time;
    v_ends_at := (v_entry->>'ends_at')::time;
    v_upgrade_pool_item_id := nullif(v_entry->>'upgrade_pool_item_id', '')::uuid;
    v_is_active := coalesce(nullif(v_entry->>'is_active', '')::boolean, true);
    select windows.id
    into v_window_id
    from public.venue_collection_windows windows
    where windows.merchant_id = p_merchant_id
      and windows.location_id = p_location_id
      and windows.isodow = v_isodow
      and windows.starts_at = v_starts_at
    order by windows.created_at desc, windows.id
    limit 1
    for update;

    if v_window_id is null then
      insert into public.venue_collection_windows (
        merchant_id, location_id, isodow, starts_at, ends_at,
        upgrade_pool_item_id, is_active
      ) values (
        p_merchant_id, p_location_id, v_isodow, v_starts_at, v_ends_at,
        v_upgrade_pool_item_id, v_is_active
      );
    else
      update public.venue_collection_windows
      set ends_at = v_ends_at,
          upgrade_pool_item_id = v_upgrade_pool_item_id,
          is_active = v_is_active
      where id = v_window_id;
    end if;
  end loop;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    case when public.is_internal_admin() then 'admin' else 'merchant' end,
    (select auth.uid())::text,
    p_merchant_id,
    'venue_collection_windows',
    p_location_id,
    'venue_collection_windows_saved',
    jsonb_build_object(
      'location_id', p_location_id,
      'window_count', jsonb_array_length(p_windows)
    )
  );
end;
$function$;

create or replace function public.add_venue_closure(
  p_merchant_id uuid,
  p_location_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_closure_id uuid;
begin
  if p_merchant_id is null
     or not (public.is_merchant_owner(p_merchant_id) or public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  if p_location_id is null
     or not exists (
       select 1 from public.merchant_locations locations
       where locations.id = p_location_id and locations.merchant_id = p_merchant_id
     ) then
    raise exception 'The closure location does not belong to this merchant'
      using errcode = 'NBW05';
  end if;

  if p_starts_at is null
     or p_ends_at is null
     or p_starts_at >= p_ends_at
     or p_ends_at - p_starts_at > interval '90 days'
     or length(trim(coalesce(p_reason, ''))) not between 1 and 200 then
    raise exception 'Closure dates or reason are invalid'
      using errcode = 'NBW05';
  end if;

  insert into public.venue_closures (
    merchant_id, location_id, starts_at, ends_at, reason, created_by
  ) values (
    p_merchant_id, p_location_id, p_starts_at, p_ends_at, trim(p_reason), (select auth.uid())
  )
  returning id into v_closure_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    case when public.is_internal_admin() then 'admin' else 'merchant' end,
    (select auth.uid())::text,
    p_merchant_id,
    'venue_closures',
    v_closure_id,
    'venue_closure_added',
    jsonb_build_object(
      'location_id', p_location_id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'reason', trim(p_reason)
    )
  );

  return v_closure_id;
end;
$function$;

create or replace function public.end_venue_closure(p_closure_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_closure record;
  v_ended_at timestamptz := now();
begin
  select closures.*
  into v_closure
  from public.venue_closures closures
  where closures.id = p_closure_id
  for update;

  if v_closure.id is null
     or not (
       public.is_merchant_owner(v_closure.merchant_id)
       or public.is_internal_admin()
     ) then
    raise exception 'Venue closure not found'
      using errcode = 'NBW07';
  end if;

  if v_closure.ended_early_at is not null
     or v_ended_at <= v_closure.starts_at
     or v_ended_at >= v_closure.ends_at then
    raise exception 'Venue closure cannot be ended now'
      using errcode = 'NBW07';
  end if;

  update public.venue_closures
  set ended_early_at = v_ended_at
  where id = p_closure_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    case when public.is_internal_admin() then 'admin' else 'merchant' end,
    (select auth.uid())::text,
    v_closure.merchant_id,
    'venue_closures',
    p_closure_id,
    'venue_closure_ended_early',
    jsonb_build_object(
      'scheduled_ends_at', v_closure.ends_at,
      'ended_early_at', v_ended_at
    )
  );

  return v_ended_at;
end;
$function$;

-- 5. Function containment -------------------------------------------------------

revoke all on function private.guard_venue_collection_window_overlap()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_venue_closure_overlap()
  from public, anon, authenticated, service_role;

revoke all on function public.save_venue_collection_windows(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.add_venue_closure(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.end_venue_closure(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.save_venue_collection_windows(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.add_venue_closure(uuid, uuid, timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.end_venue_closure(uuid)
  to authenticated;

notify pgrst, 'reload schema';
