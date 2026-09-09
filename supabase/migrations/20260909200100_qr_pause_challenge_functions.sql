create function public.issue_qr_pause_challenge(p_owner_user_id uuid, p_qr_code_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_email text; v_qr public.qr_codes%rowtype; v_id uuid; v_latest timestamptz;
begin
  if p_code is null or p_code !~ '^[0-9]{6}$' then raise exception 'Invalid code format'; end if;
  perform pg_advisory_xact_lock(hashtextextended('qr-pause-owner:' || p_owner_user_id::text, 0));
  select lower(trim(email)) into v_email from auth.users
    where id = p_owner_user_id and email_confirmed_at is not null for share;
  if nullif(v_email, '') is null then return jsonb_build_object('status', 'email_required'); end if;
  perform pg_advisory_xact_lock(hashtextextended('qr-pause-email:' || v_email, 0));
  perform 1 from public.merchants m join public.qr_codes q on q.merchant_id = m.id
    where q.id = p_qr_code_id and m.owner_user_id = p_owner_user_id for share of m;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  select * into v_qr from public.qr_codes where id = p_qr_code_id and destination_type = 'join' for update;
  if v_qr.id is null or not v_qr.is_active then return jsonb_build_object('status', 'unavailable'); end if;
  select max(created_at) into v_latest from public.qr_pause_challenges
    where owner_user_id = p_owner_user_id or owner_email = v_email;
  if v_latest > now() - interval '60 seconds' then
    return jsonb_build_object('status', 'throttled', 'retry_at', v_latest + interval '60 seconds');
  end if;
  if (select count(*) from public.qr_pause_challenges where owner_user_id = p_owner_user_id and created_at > now() - interval '15 minutes') >= 5
    or (select count(*) from public.qr_pause_challenges where owner_email = v_email and created_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('status', 'throttled', 'retry_at', now() + interval '15 minutes');
  end if;
  update public.qr_pause_challenges set state = 'superseded'
    where owner_user_id = p_owner_user_id and qr_code_id = p_qr_code_id and state in ('sending', 'ready');
  insert into public.qr_pause_challenges(owner_user_id, merchant_id, qr_code_id, owner_email, status_revision, code_hash)
    values (p_owner_user_id, v_qr.merchant_id, v_qr.id, v_email, v_qr.status_revision, crypt(p_code, gen_salt('bf', 10))) returning id into v_id;
  return jsonb_build_object('status', 'issued', 'challenge_id', v_id, 'email', v_email,
    'venue_name', (select business_name from public.merchants where id = v_qr.merchant_id),
    'retry_at', now() + interval '60 seconds');
end;
$$;
revoke all on function public.issue_qr_pause_challenge(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_qr_pause_challenge(uuid, uuid, text) to service_role;

-- Private helper: only mutation functions enqueue confirmations, never callers.
create function public.record_merchant_qr_transition(p_qr_code_id uuid, p_owner_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_qr public.qr_codes%rowtype; v_merchant public.merchants%rowtype;
  v_transition uuid := gen_random_uuid(); v_owner_email text; v_action text; v_available boolean;
begin
  select * into strict v_qr from public.qr_codes where id = p_qr_code_id;
  select * into strict v_merchant from public.merchants where id = v_qr.merchant_id;
  select lower(trim(email)) into v_owner_email from auth.users where id = p_owner_user_id and email_confirmed_at is not null;
  v_action := case when v_qr.is_active then 'qr_enabled' else 'qr_disabled' end;
  v_available := v_qr.is_active and v_merchant.status in ('active', 'trial') and (not v_merchant.requires_billing or exists (
    select 1 from public.billing_customers where merchant_id = v_merchant.id and status in ('active', 'trialing', 'trial')))
    and exists (select 1 from public.loyalty_cards where id = v_qr.loyalty_card_id and is_active);
  insert into public.product_events(event_name, merchant_id, qr_code_id, actor_type, actor_id, metadata)
    values(v_action, v_merchant.id, v_qr.id, 'merchant', p_owner_user_id::text,
      jsonb_build_object('source', 'merchant_qr_action', 'is_active', v_qr.is_active, 'transition_id', v_transition));
  insert into public.audit_logs(actor_type, actor_id, merchant_id, target_table, target_id, action, metadata)
    values('merchant', p_owner_user_id::text, v_merchant.id, 'qr_codes', v_qr.id, v_action,
      jsonb_build_object('is_active', v_qr.is_active, 'transition_id', v_transition, 'status_revision', v_qr.status_revision));
  if v_qr.destination_type <> 'join' then return; end if;
  insert into public.qr_status_email_outbox(transition_id, merchant_id, qr_code_id, recipient, venue_name, is_active, scans_available)
    select v_transition, v_merchant.id, v_qr.id, recipient, v_merchant.business_name, v_qr.is_active, coalesce(v_available, false)
    from (select distinct lower(trim(address)) as recipient from unnest(array[v_owner_email, v_merchant.email]) as address) recipients
    where nullif(recipient, '') is not null;
end;
$$;
revoke all on function public.record_merchant_qr_transition(uuid, uuid) from public, anon, authenticated, service_role;

create function public.verify_and_pause_qr(p_challenge_id uuid, p_qr_code_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_owner uuid := auth.uid(); v_email text; v_qr public.qr_codes%rowtype; v_challenge public.qr_pause_challenges%rowtype;
begin
  if v_owner is null then raise insufficient_privilege using message = 'Owner authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('qr-pause-owner:' || v_owner::text, 0));
  select lower(trim(email)) into v_email from auth.users where id = v_owner and email_confirmed_at is not null for share;
  if nullif(v_email, '') is null then return jsonb_build_object('status', 'email_required'); end if;
  if (select count(*) from public.qr_pause_attempts where owner_user_id = v_owner and created_at > now() - interval '15 minutes') >= 20 then
    return jsonb_build_object('status', 'throttled');
  end if;
  insert into public.qr_pause_attempts(owner_user_id) values(v_owner);
  perform 1 from public.merchants m join public.qr_codes q on q.merchant_id = m.id
    where q.id = p_qr_code_id and m.owner_user_id = v_owner for share of m;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  select * into v_qr from public.qr_codes where id = p_qr_code_id and destination_type = 'join' for update;
  select * into v_challenge from public.qr_pause_challenges where id = p_challenge_id
    and owner_user_id = v_owner and owner_email = v_email and merchant_id = v_qr.merchant_id and qr_code_id = v_qr.id for update;
  if v_challenge.id is null then return jsonb_build_object('status', 'unavailable'); end if;
  -- A retry reports the original operation; it never reapplies it after resume.
  if v_challenge.state = 'used' then return jsonb_build_object('status', 'already_completed'); end if;
  if v_challenge.state <> 'ready' then return jsonb_build_object('status', 'superseded'); end if;
  if v_challenge.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if v_challenge.attempts >= 5 then return jsonb_build_object('status', 'locked'); end if;
  if not v_qr.is_active or v_qr.status_revision <> v_challenge.status_revision then return jsonb_build_object('status', 'stale'); end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' or crypt(p_code, v_challenge.code_hash) <> v_challenge.code_hash then
    update public.qr_pause_challenges set attempts = attempts + 1 where id = v_challenge.id;
    return jsonb_build_object('status', case when v_challenge.attempts >= 4 then 'locked' else 'incorrect' end);
  end if;
  update public.qr_pause_challenges set state = 'used', used_at = now() where id = v_challenge.id;
  update public.qr_codes set is_active = false where id = v_qr.id;
  perform public.record_merchant_qr_transition(v_qr.id, v_owner);
  return jsonb_build_object('status', 'paused');
end;
$$;
revoke all on function public.verify_and_pause_qr(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.verify_and_pause_qr(uuid, uuid, text) to authenticated;
