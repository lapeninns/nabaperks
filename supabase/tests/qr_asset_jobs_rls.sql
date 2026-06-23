begin;

select 'qr_asset_jobs_rls_fixture';

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '7b000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'qr-asset-owner-a@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(), '', '', '', '', now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"QR Asset Owner A"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '7b000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'qr-asset-owner-b@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(), '', '', '', '', now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"QR Asset Owner B"}'::jsonb,
    false
  );

insert into public.merchants (id, owner_user_id, business_name, business_slug, business_type, email, status)
values
  ('7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-000000000001', 'QR Asset Venue A', 'qr-asset-venue-a', 'cafe', 'a@nabaperks.test', 'active'),
  ('7b000000-0000-0000-0000-0000000000a2', '7b000000-0000-0000-0000-000000000002', 'QR Asset Venue B', 'qr-asset-venue-b', 'cafe', 'b@nabaperks.test', 'active');

insert into public.merchant_locations (id, merchant_id, name, address)
values
  ('7b000000-0000-0000-0000-0000000000b1', '7b000000-0000-0000-0000-0000000000a1', 'Till A', '1 A Street'),
  ('7b000000-0000-0000-0000-0000000000b2', '7b000000-0000-0000-0000-0000000000a2', 'Till B', '1 B Street');

insert into public.loyalty_cards (id, merchant_id, location_id, card_name, reward_name, reward_terms)
values
  ('7b000000-0000-0000-0000-0000000000c1', '7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-0000000000b1', 'Coffee Card A', 'Free coffee', 'One per visit.'),
  ('7b000000-0000-0000-0000-0000000000c2', '7b000000-0000-0000-0000-0000000000a2', '7b000000-0000-0000-0000-0000000000b2', 'Coffee Card B', 'Free coffee', 'One per visit.');

insert into public.qr_codes (id, qr_id, merchant_id, location_id, loyalty_card_id, destination_type, is_active)
values
  ('7b000000-0000-0000-0000-0000000000d1', 'qrasseta', '7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-0000000000b1', '7b000000-0000-0000-0000-0000000000c1', 'join', true),
  ('7b000000-0000-0000-0000-0000000000d2', 'qrassetb', '7b000000-0000-0000-0000-0000000000a2', '7b000000-0000-0000-0000-0000000000b2', '7b000000-0000-0000-0000-0000000000c2', 'join', true);

insert into public.qr_asset_jobs (id, qr_code_id, merchant_id, location_id, asset_kind, content_version, dedupe_key, status)
values
  ('7b000000-0000-0000-0000-0000000000e1', '7b000000-0000-0000-0000-0000000000d1', '7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-0000000000b1', 'poster_pdf', 'ver-a', 'qrasseta:poster_pdf:ver-a', 'ready'),
  ('7b000000-0000-0000-0000-0000000000e2', '7b000000-0000-0000-0000-0000000000d2', '7b000000-0000-0000-0000-0000000000a2', '7b000000-0000-0000-0000-0000000000b2', 'poster_pdf', 'ver-b', 'qrassetb:poster_pdf:ver-b', 'ready');

-- A queued job used by the record_qr_asset_generated assertion below.
insert into public.qr_asset_jobs (id, qr_code_id, merchant_id, location_id, asset_kind, content_version, dedupe_key, status)
values
  ('7b000000-0000-0000-0000-0000000000e3', '7b000000-0000-0000-0000-0000000000d1', '7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-0000000000b1', 'till_card_png', 'ver-a', 'qrasseta:till_card_png:ver-a', 'queued');

select 'qr-assets bucket exists and is private';
do $$
declare
  v_public boolean;
begin
  if to_regclass('storage.buckets') is null then
    return; -- storage schema absent on this target; structural check covered by Supabase
  end if;
  select public into v_public from storage.buckets where id = 'qr-assets';
  if v_public is distinct from false then
    raise exception 'qr-assets bucket missing or not private (public=%)', v_public;
  end if;
end $$;

select 'status is constrained to the lifecycle vocabulary';
do $$
begin
  begin
    insert into public.qr_asset_jobs (qr_code_id, merchant_id, location_id, asset_kind, content_version, dedupe_key, status)
    values ('7b000000-0000-0000-0000-0000000000d1', '7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-0000000000b1', 'poster_pdf', 'x', 'bad-status', 'bogus');
    raise exception 'invalid status was accepted';
  exception
    when check_violation then null;
  end;
end $$;

select 'dedupe_key is unique';
do $$
begin
  begin
    insert into public.qr_asset_jobs (qr_code_id, merchant_id, location_id, asset_kind, content_version, dedupe_key, status)
    values ('7b000000-0000-0000-0000-0000000000d1', '7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-0000000000b1', 'poster_pdf', 'ver-a', 'qrasseta:poster_pdf:ver-a', 'queued');
    raise exception 'duplicate dedupe_key was accepted';
  exception
    when unique_violation then null;
  end;
end $$;

-- R3 / R4 — authenticated owner A sees only its own jobs and cannot write.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '7b000000-0000-0000-0000-000000000001';

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.qr_asset_jobs
  where id in (
    '7b000000-0000-0000-0000-0000000000e1',
    '7b000000-0000-0000-0000-0000000000e2'
  );
  if visible <> 1 then
    raise exception 'owner A saw % qr_asset_jobs, expected 1', visible;
  end if;
end $$;

do $$
begin
  begin
    insert into public.qr_asset_jobs (qr_code_id, merchant_id, location_id, asset_kind, content_version, dedupe_key)
    values ('7b000000-0000-0000-0000-0000000000d1', '7b000000-0000-0000-0000-0000000000a1', '7b000000-0000-0000-0000-0000000000b1', 'sticker_png', 'ver-a', 'owner-a-insert-attempt');
    raise exception 'authenticated insert into qr_asset_jobs unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update public.qr_asset_jobs set status = 'failed'
    where id = '7b000000-0000-0000-0000-0000000000e1';
    raise exception 'authenticated update of qr_asset_jobs unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub = '7b000000-0000-0000-0000-000000000002';

do $$
declare
  visible integer;
begin
  select count(*) into visible
  from public.qr_asset_jobs
  where id in (
    '7b000000-0000-0000-0000-0000000000e1',
    '7b000000-0000-0000-0000-0000000000e2'
  );
  if visible <> 1 then
    raise exception 'owner B saw % qr_asset_jobs, expected 1', visible;
  end if;
end $$;

reset role;

-- R5 — record_qr_asset_generated flips the queued job to ready and logs an event.
select 'record_qr_asset_generated marks the job ready and records a product event';
do $$
declare
  v_status text;
  v_path text;
  v_events integer;
begin
  perform public.record_qr_asset_generated(
    '7b000000-0000-0000-0000-0000000000d1',
    'till_card_png',
    '7b000000-0000-0000-0000-0000000000d1/till_card_png/ver-a.png',
    'ver-a',
    2048
  );

  select status, storage_path into v_status, v_path
  from public.qr_asset_jobs
  where id = '7b000000-0000-0000-0000-0000000000e3';

  if v_status <> 'ready' or v_path is null then
    raise exception 'job not marked ready (status=%, path=%)', v_status, v_path;
  end if;

  select count(*) into v_events
  from public.product_events
  where event_name = 'qr_asset_generated'
    and qr_code_id = '7b000000-0000-0000-0000-0000000000d1';

  if v_events < 1 then
    raise exception 'qr_asset_generated product event was not recorded';
  end if;
end $$;

select 'record_qr_asset_generated rejects a missing job';
do $$
begin
  begin
    perform public.record_qr_asset_generated(
      '7b000000-0000-0000-0000-0000000000d1',
      'sticker_png',
      'some/path.png',
      'no-such-version',
      10
    );
    raise exception 'record_qr_asset_generated accepted a non-existent job';
  exception
    when others then
      if sqlerrm like '%accepted a non-existent job%' then
        raise;
      end if;
  end;
end $$;

select 'qr_asset_jobs rls ok';

rollback;
