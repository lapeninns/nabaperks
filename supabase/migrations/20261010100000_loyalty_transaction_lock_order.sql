-- BUG-076: customer -> billing -> membership -> reward -> token.
-- Customer NO KEY UPDATE serializes identity/erasure and linking without
-- blocking the FK key-share locks used by another member's referral stamp.
-- Acquire billing before membership, including the private stamp primitive.
-- All eligibility, owner authority, audit and token guards remain unchanged.
-- Existing deployed callers retain the same signatures, results and ACLs.
-- Apply guarded body edits, as the earlier consent migrations do, to avoid
-- copying large unrelated reward/geolocation policy bodies into this repair.
do $migration$
declare
  v_signature text;
  v_definition text;
  v_old text;
  v_new text;
  v_customer text;
  v_merchant text;
  v_membership text;
  v_prefix text;
  v_selection text;
begin
  for v_signature, v_customer, v_merchant, v_membership in
    select * from (values
      ('private.issue_visit_stamp(uuid,uuid,numeric,numeric,numeric,text,integer,text,jsonb)',
       'p_customer_id',
       '(select m.merchant_id from public.customer_memberships m where m.id = p_membership_id and m.customer_id = p_customer_id)',
       'p_membership_id'),
      ('private.issue_qr_visit_stamp(uuid,uuid,text,numeric,numeric,numeric,text,integer,integer,text,jsonb)',
       'p_customer_id',
       '(select m.merchant_id from public.customer_memberships m where m.id = p_membership_id and m.customer_id = p_customer_id)',
       'p_membership_id'),
      ('public.issue_venue_code_stamp(uuid,uuid,text,text,text,integer)',
       'p_customer_id',
       '(select m.merchant_id from public.customer_memberships m where m.id = p_membership_id and m.customer_id = p_customer_id)',
       'p_membership_id'),
      ('public.retry_customer_join_first_stamp(uuid,uuid)',
       'p_customer_id',
       '(select m.merchant_id from public.customer_memberships m where m.id = p_membership_id and m.customer_id = p_customer_id)',
       'p_membership_id'),
      ('public.create_reward_scan_token(uuid,uuid)', 'p_customer_id',
       '(select r.merchant_id from public.reward_events r where r.id = p_reward_event_id and r.customer_id = p_customer_id)',
       '(select r.membership_id from public.reward_events r where r.id = p_reward_event_id and r.customer_id = p_customer_id)'),
      ('public.redeem_self_service_reward(uuid,uuid,numeric,numeric)', 'p_customer_id',
       '(select r.merchant_id from public.reward_events r where r.id = p_reward_event_id and r.customer_id = p_customer_id)',
       '(select r.membership_id from public.reward_events r where r.id = p_reward_event_id and r.customer_id = p_customer_id)'),
      ('private.redeem_self_service_reward_transition(uuid,uuid,numeric,numeric)', 'p_customer_id',
       '(select r.merchant_id from public.reward_events r where r.id = p_reward_event_id and r.customer_id = p_customer_id)',
       '(select r.membership_id from public.reward_events r where r.id = p_reward_event_id and r.customer_id = p_customer_id)')
    ) as operations(signature, customer_id, merchant_id, membership_id)
  loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    v_old := E'begin\n';
    v_prefix := format($lock$
  -- BUG-076 common transaction lock order; authority is rechecked below.
  perform 1 from public.customers where id = %s for no key update;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || %s::text, 0)
  );
  perform 1 from public.customer_memberships where id = %s for update;
$lock$, v_customer, v_merchant, v_membership);
    if position('BUG-076 common transaction lock order' in v_definition) > 0 then
      continue;
    end if;
    if position(v_old in v_definition) = 0 then
      raise exception 'Unsupported installed function body: %', v_signature;
    end if;
    -- Only the first BEGIN is the function entry, not nested exception blocks.
    v_definition := overlay(v_definition placing v_old || v_prefix
      from position(v_old in v_definition) for length(v_old));
    v_definition := replace(v_definition,
      'from public.customers where id = p_customer_id for update;',
      'from public.customers where id = p_customer_id for no key update;');
    execute v_definition;
  end loop;

  for v_signature, v_old, v_new in select * from (values
    ('public.collect_owner_reward_scan_token(uuid)',
     E'  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(''billing-state:'' || v_token.merchant_id::text, 0)\n  );\n  perform 1 from public.customers where id = v_token.customer_id for update;',
     E'  perform 1 from public.customers where id = v_token.customer_id for no key update;\n  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(''billing-state:'' || v_token.merchant_id::text, 0)\n  );\n  perform 1 from public.customer_memberships where id = v_token.membership_id for update;'),
    ('public.verify_and_collect_reward_scan_token(uuid,date,boolean)',
     E'  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(''billing-state:'' || v_token.merchant_id::text, 0)\n  );\n  select * into v_customer from public.customers where id = v_token.customer_id for update;',
     E'  select * into v_customer from public.customers where id = v_token.customer_id for no key update;\n  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(''billing-state:'' || v_token.merchant_id::text, 0)\n  );\n  perform 1 from public.customer_memberships where id = v_token.membership_id for update;'),
    ('public.collect_reward_scan_token(uuid,uuid)',
     E'  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(''billing-state:'' || token_record.merchant_id::text, 0)\n  );\n  perform 1 from public.customers where id = token_record.customer_id for update;',
     E'  perform 1 from public.customers where id = token_record.customer_id for no key update;\n  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(''billing-state:'' || token_record.merchant_id::text, 0)\n  );\n  perform 1 from public.customer_memberships where id = token_record.membership_id for update;'),
    ('public.require_eligible_reward_for_scan_token()',
     'from public.customers where id = new.customer_id for update;',
     'from public.customers where id = new.customer_id for no key update;')
  ) as repairs(signature, old_body, new_body)
  loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if position(v_new in v_definition) > 0 then continue; end if;
    if position(v_old in v_definition) = 0 then
      raise exception 'Unsupported installed function body: %', v_signature;
    end if;
    execute replace(v_definition, v_old, v_new);
  end loop;

  v_signature := 'public.link_verified_customer_wallets(uuid,uuid,text,text)';
  v_definition := pg_get_functiondef(v_signature::regprocedure);
  v_old := '  -- Serialize with stamp/reward RPCs before inspecting or moving their ledgers.';
  v_new := $link$
  -- BUG-076: customer locks above precede sorted billing locks, then membership.
  -- All merchant IDs are read after both customer locks, which fence venue joins.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || venues.merchant_id::text, 0)
  ) from (
    select distinct m.merchant_id from public.customer_memberships m
    where m.customer_id in (v_phone.id, v_email.id) order by m.merchant_id
  ) venues;
  -- Serialize with stamp/reward RPCs before inspecting or moving their ledgers.
$link$;
  if position('BUG-076: customer locks above' in v_definition) = 0 then
    if position(v_old in v_definition) = 0 then
      raise exception 'Unsupported installed function body: %', v_signature;
    end if;
    execute replace(v_definition, v_old, v_new);
  end if;

  -- A QR visit may settle a referral while already holding its billing lock.
  -- Background settlement must take that same lock before reserving an edge.
  for v_signature, v_merchant in select * from (values
    ('public.settle_referral_bonus(uuid)',
     '(select r.venue_id from public.referrals r where r.id = p_referral_id)'),
    ('public.drain_due_referrer_bonuses_for_membership(uuid)',
     '(select m.merchant_id from public.customer_memberships m where m.id = p_referrer_membership_id)')
  ) as referrals(signature, merchant_id)
  loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if position('BUG-076 referral billing before edge' in v_definition) > 0 then continue; end if;
    v_prefix := format($referral$
  -- BUG-076 referral billing before edge; FK customer locks stay key-share.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || %s::text, 0)
  );
$referral$, v_merchant);
    v_old := E'begin\n';
    if position(v_old in v_definition) = 0 then
      raise exception 'Unsupported installed function body: %', v_signature;
    end if;
    execute overlay(v_definition placing v_old || v_prefix
      from position(v_old in v_definition) for length(v_old));
  end loop;

  v_signature := 'public.drain_due_referral_bonuses(integer)';
  v_definition := pg_get_functiondef(v_signature::regprocedure);
  if position('BUG-076 bounded edge billing reservation' in v_definition) = 0 then
    v_old := E'  for r in\n';
    v_selection := split_part(split_part(v_definition, v_old, 2), E'    for update skip locked\n', 1);
    if v_selection = '' or position('limit greatest(p_limit, 1)' in v_selection) = 0 then
      raise exception 'Unsupported installed function body: %', v_signature;
    end if;
    v_prefix := E'  -- BUG-076 bounded edge billing reservation before SKIP LOCKED.\n'
      || E'  select array_agg(candidate.id) into v_edge_ids from (\n'
      || v_selection || E'  ) candidate;\n'
      || E'  perform pg_catalog.pg_advisory_xact_lock(\n'
      || E'    pg_catalog.hashtextextended(''billing-state:'' || venues.venue_id::text, 0)\n'
      || E'  ) from (select distinct edges.venue_id from public.referrals edges\n'
      || E'    where edges.id = any(v_edge_ids) order by edges.venue_id) venues;\n';
    v_definition := replace(v_definition, '  r record;', E'  r record;\n  v_edge_ids uuid[];');
    v_definition := replace(v_definition, v_old, v_prefix || v_old);
    -- The reservation uses the fixed bounded candidate set after lock waits.
    v_definition := replace(v_definition,
      E'    where referrals.referrer_bonus_awarded_at is null',
      E'    where referrals.id = any(v_edge_ids)\n      and referrals.referrer_bonus_awarded_at is null');
    -- The first selection is the snapshot, before v_edge_ids exists.
    v_definition := overlay(v_definition placing
      E'    where referrals.referrer_bonus_awarded_at is null'
      from position(E'    where referrals.id = any(v_edge_ids)\n      and referrals.referrer_bonus_awarded_at is null' in v_definition)
      for length(E'    where referrals.id = any(v_edge_ids)\n      and referrals.referrer_bonus_awarded_at is null'));
    execute v_definition;
  end if;
end;
$migration$;
