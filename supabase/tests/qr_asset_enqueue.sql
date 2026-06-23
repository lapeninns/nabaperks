begin;

select 'qr_asset_enqueue_fixture';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
)
values (
  '00000000-0000-0000-0000-000000000000',
  '7c000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'qr-enqueue-owner@nabaperks.test',
  extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
  now(), '', '', '', '', now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"QR Enqueue Owner"}'::jsonb, false
);

insert into public.merchants (id, owner_user_id, business_name, business_slug, business_type, email, status)
values ('7c000000-0000-0000-0000-0000000000a1', '7c000000-0000-0000-0000-000000000001', 'Enqueue Venue', 'qr-enqueue-venue', 'cafe', 'enqueue@nabaperks.test', 'active');

insert into public.merchant_locations (id, merchant_id, name, address)
values ('7c000000-0000-0000-0000-0000000000b1', '7c000000-0000-0000-0000-0000000000a1', 'Till', '1 Enqueue Street');

insert into public.loyalty_cards (id, merchant_id, location_id, card_name, reward_name, reward_terms)
values ('7c000000-0000-0000-0000-0000000000c1', '7c000000-0000-0000-0000-0000000000a1', '7c000000-0000-0000-0000-0000000000b1', 'Enqueue Card', 'Free coffee', 'One per visit.');

select 'creating a join QR enqueues one queued job per asset kind';
insert into public.qr_codes (id, qr_id, merchant_id, location_id, loyalty_card_id, destination_type, is_active)
values ('7c000000-0000-0000-0000-0000000000d1', 'qrenqueue', '7c000000-0000-0000-0000-0000000000a1', '7c000000-0000-0000-0000-0000000000b1', '7c000000-0000-0000-0000-0000000000c1', 'join', true);

do $$
declare
  v_count integer;
  v_versions integer;
begin
  select count(*) into v_count
  from public.qr_asset_jobs
  where qr_code_id = '7c000000-0000-0000-0000-0000000000d1' and status = 'queued';
  if v_count <> 3 then
    raise exception 'expected 3 queued jobs on create, got %', v_count;
  end if;

  select count(distinct content_version) into v_versions
  from public.qr_asset_jobs
  where qr_code_id = '7c000000-0000-0000-0000-0000000000d1';
  if v_versions <> 1 then
    raise exception 'expected a single content_version on create, got %', v_versions;
  end if;
end $$;

select 're-enqueueing the same QR dedupes (no duplicate jobs)';
do $$
declare
  v_count integer;
begin
  perform public.enqueue_qr_asset_jobs('7c000000-0000-0000-0000-0000000000d1');
  select count(*) into v_count
  from public.qr_asset_jobs
  where qr_code_id = '7c000000-0000-0000-0000-0000000000d1';
  if v_count <> 3 then
    raise exception 'expected dedupe to keep 3 jobs, got %', v_count;
  end if;
end $$;

select 'a pixel-affecting change (is_active) produces a new content version';
update public.qr_codes
set is_active = false
where id = '7c000000-0000-0000-0000-0000000000d1';

do $$
declare
  v_versions integer;
begin
  select count(distinct content_version) into v_versions
  from public.qr_asset_jobs
  where qr_code_id = '7c000000-0000-0000-0000-0000000000d1';
  if v_versions <> 2 then
    raise exception 'expected 2 content versions after toggle, got %', v_versions;
  end if;
end $$;

select 'updating QR source labels enqueues fresh content versions';
update public.loyalty_cards
set reward_name = 'Free pastry'
where id = '7c000000-0000-0000-0000-0000000000c1';

update public.merchant_locations
set name = 'Garden till'
where id = '7c000000-0000-0000-0000-0000000000b1';

update public.merchants
set business_name = 'Updated Enqueue Venue'
where id = '7c000000-0000-0000-0000-0000000000a1';

do $$
declare
  v_versions integer;
begin
  select count(distinct content_version) into v_versions
  from public.qr_asset_jobs
  where qr_code_id = '7c000000-0000-0000-0000-0000000000d1';
  if v_versions <> 5 then
    raise exception 'expected 5 content versions after source label updates, got %', v_versions;
  end if;
end $$;

select 'content version is stable for identical inputs and changes with them';
do $$
begin
  if public.build_qr_asset_content_version('q', 'Biz', 'Loc', 'Card', 'Reward', true)
     <> public.build_qr_asset_content_version('q', 'Biz', 'Loc', 'Card', 'Reward', true) then
    raise exception 'content version is not stable for identical inputs';
  end if;
  if public.build_qr_asset_content_version('q', 'Biz', 'Loc', 'Card', 'Reward', true)
     = public.build_qr_asset_content_version('q', 'Biz', 'Loc', 'Card', 'Reward', false) then
    raise exception 'content version did not change when is_active changed';
  end if;
end $$;

select 'qr asset enqueue ok';

rollback;
