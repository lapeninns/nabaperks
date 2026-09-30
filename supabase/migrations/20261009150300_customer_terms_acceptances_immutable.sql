-- Accepted venue terms are immutable (QA BUG-038, 38c42a1..2c45031).
--
-- WHY
--   The customer terms promise "an immutable copy of the venue terms
--   accepted". public.customer_loyalty_terms_acceptances had only BEFORE
--   INSERT triggers, and service_role kept UPDATE and DELETE through the
--   schema's default privileges, so any service-role caller could rewrite a
--   snapshot with a matching hash, backdate it, or delete it. No application
--   path updates or deletes these rows.
--
-- WHAT CHANGES
--   A BEFORE UPDATE OR DELETE trigger refuses every change with
--   insufficient_privilege (42501), for every role, except:
--     * when app.customer_erasure is 'true', the transaction-local flag the
--       erasure and retention functions already set around their writes;
--     * a DELETE whose membership, customer or merchant row no longer exists,
--       which is the ON DELETE CASCADE from that parent;
--     * an UPDATE that only clears qr_code_id after its QR code was deleted,
--       which is the ON DELETE SET NULL from qr_codes;
--     * inside verified wallet linking (PR #410), when app.customer_wallet_link
--       is 'true': a DELETE (a duplicate acceptance, whose copy the link has
--       already kept in private.customer_wallet_links evidence), or an UPDATE
--       that only moves customer_id and membership_id to the surviving wallet.
--       The terms content and acceptance time can never change.
--   public.link_verified_customer_wallets is re-created unchanged except that
--   it sets that transaction-local flag and clears it before every return.
--   A trigger holds even for service_role, which does not own the table and
--   has no TRIGGER privilege on it.
--
-- COMPATIBILITY
--   The deployed app only inserts and reads these rows; wallet linking keeps
--   its signature and behaviour. Customer,
--   membership, merchant and QR deletion, admin erasure and retention keep
--   working. Grants are unchanged.
--
-- Forward-only and re-runnable.

create or replace function public.protect_customer_loyalty_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if coalesce(current_setting('app.customer_erasure', true), '') = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.customer_wallet_link', true), '') = 'true' then
      return old;
    end if;
    if not exists (
         select 1 from public.customer_memberships
         where id = old.membership_id
       )
       or not exists (
         select 1 from public.customers where id = old.customer_id
       )
       or not exists (
         select 1 from public.merchants where id = old.merchant_id
       ) then
      return old;
    end if;
  elsif coalesce(current_setting('app.customer_wallet_link', true), '') = 'true'
    and (to_jsonb(new) - 'customer_id' - 'membership_id')
      = (to_jsonb(old) - 'customer_id' - 'membership_id') then
    return new;
  elsif old.qr_code_id is not null
    and new.qr_code_id is null
    and (to_jsonb(new) - 'qr_code_id') = (to_jsonb(old) - 'qr_code_id')
    and not exists (
      select 1 from public.qr_codes where id = old.qr_code_id
    ) then
    return new;
  end if;

  raise exception using
    errcode = 'insufficient_privilege',
    message = 'Accepted venue terms are immutable',
    hint = 'Terms acceptances are removed only with their membership, customer or merchant, by customer erasure, or when verified wallets are linked.';
end;
$function$;
revoke all on function public.protect_customer_loyalty_terms_acceptance()
  from public, anon, authenticated;
grant execute on function public.protect_customer_loyalty_terms_acceptance()
  to service_role;

drop trigger if exists customer_terms_acceptance_immutable
  on public.customer_loyalty_terms_acceptances;
create trigger customer_terms_acceptance_immutable
before update or delete on public.customer_loyalty_terms_acceptances
for each row execute function public.protect_customer_loyalty_terms_acceptance();

-- Verified wallet linking (20261008100000) with the link flag.
create or replace function public.link_verified_customer_wallets(
  p_customer_id uuid, p_session_id uuid, p_method text, p_contact_hmac text
)
returns table(status text, customer_id uuid)
language plpgsql security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_current public.customers%rowtype;
  v_phone public.customers%rowtype;
  v_email public.customers%rowtype;
  v_other uuid;
  v_session public.customer_sessions%rowtype;
  v_source public.customer_memberships%rowtype;
  v_target public.customer_memberships%rowtype;
  v_cycle integer;
  v_threshold integer;
  v_reward uuid;
  v_evidence jsonb := '{}'::jsonb;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Verified wallet linking requires the server';
  end if;
  -- Lets the terms-acceptance guard accept this transaction's moves and
  -- de-duplication of acceptances (QA BUG-038); cleared before every return.
  perform set_config('app.customer_wallet_link', 'true', true);
  if p_method not in ('phone', 'email') or p_contact_hmac is null then
    perform set_config('app.customer_wallet_link', 'false', true);
    return query select 'conflict'::text, null::uuid; return;
  end if;
  select * into v_session from public.customer_sessions s
    where s.id = p_session_id and s.customer_id = p_customer_id;
  if not found or v_session.revoked_at is not null or v_session.expires_at <= now()
    or v_session.created_at < now() - interval '10 minutes' then
    perform set_config('app.customer_wallet_link', 'false', true);
    return query select 'reauthenticate'::text, null::uuid; return;
  end if;
  select c.id into v_other from public.customers c
    where (p_method = 'phone' and c.phone_hmac = p_contact_hmac and c.phone_verified_at is not null)
       or (p_method = 'email' and c.email_hmac = p_contact_hmac and c.email_verified_at is not null);
  if v_other is null or v_other = p_customer_id then
    perform set_config('app.customer_wallet_link', 'false', true);
    return query select 'conflict'::text, null::uuid; return;
  end if;
  -- Allow stamp FK key-share locks; venue joins take a conflicting share lock.
  perform c.id from public.customers c where c.id in (p_customer_id,v_other)
    order by c.id for no key update;
  perform s.id from public.customer_sessions s
    where s.customer_id in (p_customer_id,v_other) order by s.id for update;
  select * into v_session from public.customer_sessions s
    where s.id = p_session_id and s.customer_id = p_customer_id;
  if not found or v_session.revoked_at is not null or v_session.expires_at <= now()
    or v_session.created_at < now() - interval '10 minutes' then
    perform set_config('app.customer_wallet_link', 'false', true);
    return query select 'reauthenticate'::text, null::uuid; return;
  end if;
  select * into v_current from public.customers c where c.id = p_customer_id;
  if p_method = 'phone' then
    v_email := v_current;
    select * into v_phone from public.customers c where c.id = v_other;
  else
    v_phone := v_current;
    select * into v_email from public.customers c where c.id = v_other;
  end if;
  if v_phone.phone_verified_at is null or v_email.email_verified_at is null
    or v_phone.phone_hmac is null or v_email.email_hmac is null
    or v_email.phone_verified_at is not null or v_email.auth_user_id is not null
    or v_phone.email_verified_at is not null
    or (p_method = 'phone' and v_phone.phone_hmac <> p_contact_hmac)
    or (p_method = 'email' and v_email.email_hmac <> p_contact_hmac)
    or exists (select 1 from private.customer_wallet_links l
      where l.source_customer_id in (v_phone.id,v_email.id)) then
    perform set_config('app.customer_wallet_link', 'false', true);
    return query select 'conflict'::text, null::uuid; return;
  end if;
  if v_email.date_of_birth_verified_at is not null then
    perform set_config('app.customer_wallet_link', 'false', true);
    return query select 'requires_review'::text,null::uuid; return;
  end if;
  -- Serialize with stamp/reward RPCs before inspecting or moving their ledgers.
  perform m.id from public.customer_memberships m
    where m.customer_id in (v_phone.id,v_email.id) order by m.id for update;
  if exists (select 1 from public.customer_memberships m
    where m.customer_id in (v_phone.id,v_email.id) and (
      m.current_stamp_count <> (select count(*) from public.stamp_events s
        where s.membership_id=m.id and s.cycle_number=m.active_cycle_number
          and s.event_type='earned')
      or exists (select 1 from public.stamp_events s
        where s.membership_id=m.id and s.cycle_number=m.active_cycle_number
          and s.event_type <> 'earned')
      or exists (select 1 from public.stamp_events s join public.loyalty_cards c
        on c.merchant_id=m.merchant_id and c.is_active
        where s.membership_id=m.id and s.cycle_number=m.active_cycle_number
          and s.loyalty_card_id <> c.id)))
    or exists (select 1 from public.notification_preferences s
      join public.notification_preferences t on t.customer_id=v_phone.id
      where s.customer_id=v_email.id and
        (s.quiet_hours_start <> t.quiet_hours_start or s.quiet_hours_end <> t.quiet_hours_end)) then
    perform set_config('app.customer_wallet_link', 'false', true);
    return query select 'requires_review'::text,null::uuid; return;
  end if;
  set constraints all deferred;
  v_evidence := jsonb_build_object('method',p_method,'session_id',p_session_id,
    'source_memberships', (select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb)
      from public.customer_memberships m where m.customer_id = v_email.id),
    'target_memberships', (select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb)
      from public.customer_memberships m where m.customer_id = v_phone.id));
  insert into private.customer_wallet_links(source_customer_id,customer_id,evidence)
    values (v_email.id,v_phone.id,v_evidence);

  for v_source in select * from public.customer_memberships m
    where m.customer_id = v_email.id order by m.id
  loop
    select * into v_target from public.customer_memberships m
      where m.customer_id = v_phone.id and m.merchant_id = v_source.merchant_id;
    if not found then continue; end if;
    -- Different historical cards, overlapping visit dates and conflicting
    -- promotional claims need review. Never reduce stamps or rewards silently.
    if exists (select 1 from public.stamp_events s join public.stamp_events t
      on t.membership_id = v_target.id and t.event_type = 'earned'
        and t.location_id = s.location_id and t.earned_business_date = s.earned_business_date
      where s.membership_id = v_source.id and s.event_type = 'earned')
      or (select count(distinct s.loyalty_card_id) from public.stamp_events s
        where s.membership_id in (v_source.id,v_target.id)
          and s.event_type = 'earned' and s.cycle_number = case
            when s.membership_id = v_source.id then v_source.active_cycle_number
            else v_target.active_cycle_number end) > 1 then
      raise unique_violation using message = 'Wallet histories require reconciliation';
    end if;
    v_cycle := v_target.active_cycle_number + v_source.active_cycle_number - 1;
    update public.stamp_events s set cycle_number = v_cycle
      where s.membership_id = v_target.id and s.cycle_number = v_target.active_cycle_number;
    update public.stamp_events s set cycle_number = case
      when s.cycle_number = v_source.active_cycle_number then v_cycle
      else s.cycle_number + v_target.active_cycle_number - 1 end,
      metadata = s.metadata || jsonb_build_object('linked_from_membership',v_source.id)
      where s.membership_id = v_source.id;
    update public.reward_events r set cycle_number = r.cycle_number + v_target.active_cycle_number - 1,
      metadata = r.metadata || jsonb_build_object('linked_from_membership',v_source.id)
      where r.membership_id = v_source.id and r.cycle_number is not null;

    -- Duplicate terms remain in the private evidence; no acceptance is invented.
    update private.customer_wallet_links l set evidence = l.evidence ||
      jsonb_build_object('terms_' || v_source.id::text,
        (select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb)
         from public.customer_loyalty_terms_acceptances a where a.membership_id = v_source.id))
      where l.source_customer_id = v_email.id;
    delete from public.customer_loyalty_terms_acceptances s where s.membership_id = v_source.id
      and exists (select 1 from public.customer_loyalty_terms_acceptances t
        where t.membership_id = v_target.id and t.policy_version = s.policy_version);
    -- Recoveries and healer attempts are operational state. Keep their originals
    -- in link evidence, then let the surviving ledger determine the next action.
    update private.customer_wallet_links l set evidence = l.evidence || jsonb_build_object(
      'recovery_' || v_source.id::text,
        (select to_jsonb(r) from public.customer_join_stamp_recoveries r where r.membership_id = v_source.id),
      'healer_' || v_source.id::text,
        (select to_jsonb(r) from public.reward_cycle_heal_failures r where r.membership_id = v_source.id))
      where l.source_customer_id = v_email.id;
    delete from public.customer_join_stamp_recoveries s where s.membership_id = v_source.id
      and exists (select 1 from public.customer_join_stamp_recoveries t where t.membership_id = v_target.id);
    delete from public.reward_cycle_heal_failures s where s.membership_id = v_source.id
      and exists (select 1 from public.reward_cycle_heal_failures t where t.membership_id = v_target.id);
    -- Any colliding fraud/lockout/referral state fails closed through its index.
    perform private.move_wallet_references('public.customer_memberships',v_source.id,v_target.id);
    update public.customer_memberships m set active_cycle_number = v_cycle,
      current_stamp_count = v_target.current_stamp_count + v_source.current_stamp_count,
      total_stamps_earned = v_target.total_stamps_earned + v_source.total_stamps_earned,
      total_rewards_redeemed = v_target.total_rewards_redeemed + v_source.total_rewards_redeemed,
      total_rewards_expired = v_target.total_rewards_expired + v_source.total_rewards_expired,
      total_rewards_cancelled = v_target.total_rewards_cancelled + v_source.total_rewards_cancelled,
      last_visit_at = greatest(v_target.last_visit_at,v_source.last_visit_at),
      created_at = least(v_target.created_at,v_source.created_at)
      where m.id = v_target.id;
    delete from public.customer_memberships m where m.id = v_source.id;
  end loop;

  -- Preserve the stricter notification choice, never opt a customer in by linking.
  update public.notification_preferences t set
    transactional_enabled = t.transactional_enabled and s.transactional_enabled,
    reminder_enabled = t.reminder_enabled and s.reminder_enabled,
    marketing_enabled = t.marketing_enabled and s.marketing_enabled,
    phone_messages_enabled = t.phone_messages_enabled and s.phone_messages_enabled
    from public.notification_preferences s where t.customer_id = v_phone.id and s.customer_id = v_email.id;
  delete from public.notification_preferences s where s.customer_id = v_email.id
    and exists (select 1 from public.notification_preferences t where t.customer_id = v_phone.id);
  perform private.move_wallet_references('public.customers',v_email.id,v_phone.id);

  perform set_config('app.customer_erasure','true',true);
  update public.customers c set email = 'linked+' || c.id::text || '@privacy.invalid',
    email_hmac = null, email_verified_at = null, phone_hmac = null,
    phone_ciphertext = null, phone_last4 = null, phone_country = null,
    full_name = null, date_of_birth = null, date_of_birth_verified_at = null,
    date_of_birth_verification_source = null, date_of_birth_verified_by = null
    where c.id = v_email.id;
  perform set_config('app.customer_erasure','false',true);
  update public.customers c set email = v_email.email, email_hmac = v_email.email_hmac,
    email_verified_at = v_email.email_verified_at,
    full_name = coalesce(c.full_name,v_email.full_name),
    date_of_birth = coalesce(c.date_of_birth,v_email.date_of_birth)
    where c.id = v_phone.id;

  -- Existing rewards keep their IDs and statuses. Split only the unspent
  -- current-cycle stamps, minting each newly completed cycle exactly once.
  for v_target in select * from public.customer_memberships m where m.customer_id = v_phone.id
  loop
    select c.stamps_required into v_threshold from public.loyalty_cards c
      where c.merchant_id = v_target.merchant_id and c.is_active order by c.created_at limit 1;
    if v_threshold is null then continue; end if;
    with ordered as (
      select s.id, row_number() over (order by s.created_at,s.id) n
      from public.stamp_events s where s.membership_id = v_target.id
        and s.cycle_number = v_target.active_cycle_number and s.event_type = 'earned'
    ) update public.stamp_events s set cycle_number = v_target.active_cycle_number
      + ((o.n - 1) / v_threshold)::integer from ordered o where s.id = o.id;
    loop
      v_reward := private.complete_cycle_if_full(v_target.id,'wallet_link');
      exit when v_reward is null;
    end loop;
    update public.customer_memberships m set current_stamp_count = (
      select count(*) from public.stamp_events s where s.membership_id = m.id
        and s.cycle_number = m.active_cycle_number and s.event_type = 'earned'
    ) where m.id = v_target.id;
  end loop;
  update public.customer_sessions s set revoked_at = coalesce(s.revoked_at,now())
    where s.customer_id in (v_email.id,v_phone.id);
  update public.customer_otp_trusted_devices d set revoked_at = coalesce(d.revoked_at,now())
    where d.customer_id in (v_email.id,v_phone.id);
  update public.push_subscriptions s set enabled = false, revoked_at = coalesce(s.revoked_at,now())
    where s.customer_id in (v_email.id,v_phone.id);
  insert into public.audit_logs(actor_type,customer_id,target_table,target_id,action,metadata)
    values ('system',v_phone.id,'customers',v_phone.id,'customer_wallets_linked',
      jsonb_build_object('source_customer_id',v_email.id,'method',p_method));
  insert into public.product_events(event_name,customer_id,actor_type,metadata)
    values ('customer_wallets_linked',v_phone.id,'system',jsonb_build_object('method',p_method));
  set constraints all immediate;
  perform set_config('app.customer_wallet_link', 'false', true);
  return query select 'linked'::text,v_phone.id;
exception when unique_violation or check_violation then
  -- PL/pgSQL rolls the entire body back, including the link/audit entry.
  perform set_config('app.customer_wallet_link', 'false', true);
  return query select 'requires_review'::text,null::uuid;
end;
$function$;
revoke all on function public.link_verified_customer_wallets(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.link_verified_customer_wallets(uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
