-- QR asset print pipeline — Slice 2: content-addressed version + event-driven
-- enqueue. A trigger on qr_codes upserts one job per asset kind whenever a join
-- QR is created or a pixel-affecting column changes. Existing security-definer
-- RPCs (create_or_get_join_qr, set_qr_active) are intentionally NOT modified.
--
-- Idempotent: safe to re-run.

-- Stable hash over the inputs that change the rendered asset. design_version is
-- a constant bumped on any template/brand change so a refresh supersedes assets.
create or replace function public.build_qr_asset_content_version(
  p_qr_id text,
  p_business_name text,
  p_location_name text,
  p_card_name text,
  p_reward_name text,
  p_is_active boolean,
  p_design_version text default 'v1'
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      concat_ws(
        '|',
        coalesce(p_qr_id, ''),
        coalesce(p_business_name, ''),
        coalesce(p_location_name, ''),
        coalesce(p_card_name, ''),
        coalesce(p_reward_name, ''),
        case when p_is_active then '1' else '0' end,
        coalesce(p_design_version, 'v1')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- Enqueue one queued job per asset kind for a join QR, deduped by content
-- version. Reruns and no-op toggles collapse via on conflict do nothing.
create or replace function public.enqueue_qr_asset_jobs(p_qr_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_qr record;
  v_version text;
  v_kind text;
begin
  select
    q.id,
    q.qr_id,
    q.merchant_id,
    q.location_id,
    q.is_active,
    m.business_name,
    l.name as location_name,
    c.card_name,
    c.reward_name
  into v_qr
  from public.qr_codes q
  join public.merchants m on m.id = q.merchant_id
  join public.merchant_locations l on l.id = q.location_id
  left join public.loyalty_cards c on c.id = q.loyalty_card_id
  where q.id = p_qr_code_id
    and q.destination_type = 'join';

  if not found then
    return;
  end if;

  v_version := public.build_qr_asset_content_version(
    v_qr.qr_id,
    v_qr.business_name,
    v_qr.location_name,
    coalesce(v_qr.card_name, ''),
    coalesce(v_qr.reward_name, ''),
    v_qr.is_active
  );

  foreach v_kind in array array['poster_pdf', 'till_card_png', 'sticker_png']
  loop
    insert into public.qr_asset_jobs (
      qr_code_id,
      merchant_id,
      location_id,
      asset_kind,
      content_version,
      dedupe_key,
      status,
      due_at
    )
    values (
      v_qr.id,
      v_qr.merchant_id,
      v_qr.location_id,
      v_kind,
      v_version,
      v_qr.qr_id || ':' || v_kind || ':' || v_version,
      'queued',
      now()
    )
    on conflict (dedupe_key) do nothing;
  end loop;
end;
$$;

revoke all on function public.enqueue_qr_asset_jobs(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_qr_asset_jobs(uuid) to service_role;

create or replace function public.enqueue_qr_asset_jobs_for_merchant(p_merchant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.enqueue_qr_asset_jobs(q.id)
  from public.qr_codes q
  where q.merchant_id = p_merchant_id
    and q.destination_type = 'join';
end;
$$;

create or replace function public.enqueue_qr_asset_jobs_for_location(p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.enqueue_qr_asset_jobs(q.id)
  from public.qr_codes q
  where q.location_id = p_location_id
    and q.destination_type = 'join';
end;
$$;

create or replace function public.enqueue_qr_asset_jobs_for_card(p_loyalty_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.enqueue_qr_asset_jobs(q.id)
  from public.qr_codes q
  where q.loyalty_card_id = p_loyalty_card_id
    and q.destination_type = 'join';
end;
$$;

revoke all on function public.enqueue_qr_asset_jobs_for_merchant(uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_qr_asset_jobs_for_location(uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_qr_asset_jobs_for_card(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_qr_asset_jobs_for_merchant(uuid) to service_role;
grant execute on function public.enqueue_qr_asset_jobs_for_location(uuid) to service_role;
grant execute on function public.enqueue_qr_asset_jobs_for_card(uuid) to service_role;

create or replace function public.trigger_enqueue_qr_asset_jobs()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if new.destination_type = 'join' then
    perform public.enqueue_qr_asset_jobs(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.trigger_enqueue_qr_asset_jobs_for_merchant()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.enqueue_qr_asset_jobs_for_merchant(new.id);
  return new;
end;
$$;

create or replace function public.trigger_enqueue_qr_asset_jobs_for_location()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.enqueue_qr_asset_jobs_for_location(new.id);
  return new;
end;
$$;

create or replace function public.trigger_enqueue_qr_asset_jobs_for_card()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.enqueue_qr_asset_jobs_for_card(new.id);
  return new;
end;
$$;

drop trigger if exists qr_codes_enqueue_asset_jobs on public.qr_codes;
create trigger qr_codes_enqueue_asset_jobs
  after insert or update of qr_id, merchant_id, location_id, loyalty_card_id, destination_type, is_active
  on public.qr_codes
  for each row execute function public.trigger_enqueue_qr_asset_jobs();

drop trigger if exists merchants_enqueue_qr_asset_jobs on public.merchants;
create trigger merchants_enqueue_qr_asset_jobs
  after update of business_name on public.merchants
  for each row
  when (old.business_name is distinct from new.business_name)
  execute function public.trigger_enqueue_qr_asset_jobs_for_merchant();

drop trigger if exists merchant_locations_enqueue_qr_asset_jobs
  on public.merchant_locations;
create trigger merchant_locations_enqueue_qr_asset_jobs
  after update of name on public.merchant_locations
  for each row
  when (old.name is distinct from new.name)
  execute function public.trigger_enqueue_qr_asset_jobs_for_location();

drop trigger if exists loyalty_cards_enqueue_qr_asset_jobs on public.loyalty_cards;
create trigger loyalty_cards_enqueue_qr_asset_jobs
  after update of card_name, reward_name on public.loyalty_cards
  for each row
  when (
    old.card_name is distinct from new.card_name
    or old.reward_name is distinct from new.reward_name
  )
  execute function public.trigger_enqueue_qr_asset_jobs_for_card();
