-- Make subject erasure one atomic, retry-safe database operation. The function
-- consumes the authoritative relation manifest, destroys credential stores,
-- retires searchable identifiers, and emits one minimal audit fact.

create or replace function public.admin_erase_customer_pii(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_user_id uuid := (select auth.uid());
  v_auth_user_id uuid;
  v_email_hmac text;
  v_phone_hmac text;
  v_surrogate_email text;
  v_auth_surrogate_email text;
  v_erasure_id uuid;
  v_bad_relation text;
begin
  if v_admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_customer_id is null or p_merchant_id is null then
    raise exception using message = 'Customer membership context not found';
  end if;
  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception using message = 'Unsupported request channel';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_notes, ''))) < 4 then
    raise exception using message = 'Data request notes are required';
  end if;
  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception using message = 'Customer membership context not found';
  end if;

  select manifest.relation_name
  into v_bad_relation
  from public.personal_data_relation_manifest as manifest
  where manifest.relation_state = 'live'
    and (
      pg_catalog.to_regclass(manifest.relation_name) is null
      or manifest.erase_action not in (
        'anonymise_subject_row', 'delete_subject_rows', 'erase_by_prior_identifier',
        'redact_subject_rows', 'retain_consent_ledger', 'retain_loyalty_ledger',
        'retain_minimise_subject_rows', 'retain_provider_audit',
        'retain_terms_ledger', 'scrub_subject_identity'
      )
    )
  order by manifest.relation_name
  limit 1;

  if v_bad_relation is not null then
    raise exception using message = 'Personal data erasure manifest is stale';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-identity:' || p_customer_id::text, 0)
  );

  select customers.auth_user_id, customers.email_hmac, customers.phone_hmac
  into v_auth_user_id, v_email_hmac, v_phone_hmac
  from public.customers
  where customers.id = p_customer_id
  for update;

  if not found then
    raise exception using message = 'Customer not found';
  end if;

  v_surrogate_email :=
    'erased+' || pg_catalog.replace(p_customer_id::text, '-', '') || '@privacy.invalid';

  if v_auth_user_id is null
     and (select customers.email from public.customers where customers.id = p_customer_id)
       = v_surrogate_email then
    select audit_logs.id
    into v_erasure_id
    from public.audit_logs
    where audit_logs.customer_id = p_customer_id
      and audit_logs.action = 'customer_pii_erased'
    order by audit_logs.created_at, audit_logs.id
    limit 1;

    if v_erasure_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'request_type', 'deletion',
        'customer_id', p_customer_id,
        'surrogate', v_surrogate_email,
        'ledger_retained', true,
        'erasure_id', v_erasure_id
      );
    end if;
  end if;

  -- Companion operations run before identifier retirement so hashed-only
  -- invitation records remain resolvable. Any failure aborts the whole call.
  perform public.admin_erase_loyalty_invitations_for_customer(p_customer_id);
  perform public.admin_erase_offer_claims_for_customer(p_customer_id);

  update public.loyalty_invite_recipients
  set email_hmac = 'erased:' || id::text,
      email_ciphertext = null,
      email_masked = null,
      claim_token_hash = null,
      unsubscribe_token_hash = null,
      provider_message_id = null,
      failure_reason = null,
      lease_expires_at = null,
      status = case
        when status in ('queued', 'sending', 'sent', 'delivered', 'opened') then 'cancelled'
        else status
      end,
      updated_at = pg_catalog.transaction_timestamp()
  where claimed_customer_id = p_customer_id
     or (v_email_hmac is not null and email_hmac = v_email_hmac);

  update public.pending_reward_invites
  set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
      email_hmac = null,
      phone_hmac = null,
      email_masked = null,
      phone_last4 = null,
      personal_message = null,
      claim_token_hash = 'scrubbed:' || id::text,
      updated_at = pg_catalog.transaction_timestamp()
  where matched_customer_id = p_customer_id
     or attached_customer_id = p_customer_id
     or (v_phone_hmac is not null and phone_hmac = v_phone_hmac)
     or (v_email_hmac is not null and email_hmac = v_email_hmac);

  delete from public.loyalty_invite_email_suppressions
  where v_email_hmac is not null and email_hmac = v_email_hmac;
  delete from public.reward_invite_email_suppressions
  where v_email_hmac is not null and email_hmac = v_email_hmac;

  delete from public.customer_sessions where customer_id = p_customer_id;
  delete from public.push_subscriptions where customer_id = p_customer_id;
  delete from public.reward_scan_tokens where customer_id = p_customer_id;
  delete from public.notification_preferences where customer_id = p_customer_id;
  delete from public.customer_join_stamp_recoveries where customer_id = p_customer_id;

  update public.notification_events
  set status = case when status in ('queued', 'delivering') then 'cancelled' else status end,
      cancelled_at = case
        when status in ('queued', 'delivering') then pg_catalog.transaction_timestamp()
        else cancelled_at
      end,
      dedupe_key = 'erased:' || id::text,
      payload = '{}'::jsonb,
      metadata = '{}'::jsonb,
      lease_expires_at = null,
      lease_token = null,
      updated_at = pg_catalog.transaction_timestamp()
  where customer_id = p_customer_id;

  update public.fraud_flags
  set metadata = '{}'::jsonb,
      updated_at = pg_catalog.transaction_timestamp()
  where customer_id = p_customer_id;

  update public.product_events
  set actor_id = case when actor_type = 'customer' then null else actor_id end,
      metadata = '{}'::jsonb
  where customer_id = p_customer_id;

  update public.audit_logs
  set actor_id = case when actor_type = 'admin' then actor_id else null end,
      metadata = '{}'::jsonb
  where customer_id = p_customer_id;

  if v_auth_user_id is not null then
    delete from auth.mfa_challenges
    where factor_id in (select mfa_factors.id from auth.mfa_factors where user_id = v_auth_user_id);
    delete from auth.mfa_amr_claims
    where session_id in (select sessions.id from auth.sessions where user_id = v_auth_user_id);
    delete from auth.refresh_tokens where user_id = v_auth_user_id::text;
    delete from auth.one_time_tokens where user_id = v_auth_user_id;
    delete from auth.flow_state
    where user_id = v_auth_user_id or linking_target_id = v_auth_user_id;
    delete from auth.oauth_authorizations where user_id = v_auth_user_id;
    delete from auth.oauth_consents where user_id = v_auth_user_id;
    delete from auth.webauthn_challenges where user_id = v_auth_user_id;
    delete from auth.webauthn_credentials where user_id = v_auth_user_id;
    delete from auth.identities where user_id = v_auth_user_id;
    delete from auth.mfa_factors where user_id = v_auth_user_id;
    delete from auth.sessions where user_id = v_auth_user_id;

    v_auth_surrogate_email :=
      'erased+' || pg_catalog.replace(v_auth_user_id::text, '-', '') || '@privacy.invalid';
    update auth.users
    set email = v_auth_surrogate_email,
        encrypted_password = '',
        email_confirmed_at = null,
        invited_at = null,
        confirmation_token = '',
        confirmation_sent_at = null,
        recovery_token = '',
        recovery_sent_at = null,
        email_change_token_new = '',
        email_change = '',
        email_change_sent_at = null,
        last_sign_in_at = null,
        raw_app_meta_data = '{}'::jsonb,
        raw_user_meta_data = '{}'::jsonb,
        phone = null,
        phone_confirmed_at = null,
        phone_change = '',
        phone_change_token = '',
        phone_change_sent_at = null,
        email_change_token_current = '',
        email_change_confirm_status = 0,
        banned_until = 'infinity'::timestamptz,
        reauthentication_token = '',
        reauthentication_sent_at = null,
        is_sso_user = false,
        is_anonymous = true,
        deleted_at = pg_catalog.transaction_timestamp(),
        updated_at = pg_catalog.transaction_timestamp()
    where id = v_auth_user_id;
  end if;

  perform pg_catalog.set_config('app.customer_erasure', 'true', true);
  update public.customers
  set auth_user_id = null,
      email = v_surrogate_email,
      email_hmac = null,
      email_verified_at = null,
      full_name = null,
      date_of_birth = null,
      phone_hmac = null,
      phone_ciphertext = null,
      phone_last4 = null,
      phone_country = null,
      phone_verified_at = null,
      updated_at = pg_catalog.transaction_timestamp()
  where id = p_customer_id;
  perform pg_catalog.set_config('app.customer_erasure', '', true);

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', v_admin_user_id::text, p_merchant_id, p_customer_id,
    'customers', p_customer_id, 'customer_pii_erased',
    pg_catalog.jsonb_build_object(
      'request_type', 'deletion',
      'channel', p_channel,
      'ledger_retained', true
    )
  )
  returning id into v_erasure_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'request_type', 'deletion',
    'customer_id', p_customer_id,
    'surrogate', v_surrogate_email,
    'ledger_retained', true,
    'erasure_id', v_erasure_id
  );
end;
$function$;

revoke all on function public.admin_erase_customer_pii(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_erase_customer_pii(uuid, uuid, text, text)
  to service_role;

-- Preserve the locked retention sweep while fencing customers with a current
-- unrevoked session at both candidate selection and the locked recheck.
create or replace function public.admin_purge_stale_customer_pii(
  p_cutoff timestamp with time zone default (now() - '365 days'::interval)
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  stale_customer record;
  purged_count integer := 0;
  v_phone_hmac text;
  v_email_hmac text;
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'admin_purge_stale_customer_pii requires the service role';
  end if;

  perform set_config('app.customer_erasure', 'true', true);

  for stale_customer in
    select customers.id
    from public.customers
    where customers.updated_at < p_cutoff
      and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = customers.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = customers.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = customers.id
          and stamp_events.created_at >= p_cutoff
      )
      and not exists (
        select 1 from public.customer_sessions
        where customer_sessions.customer_id = customers.id
          and customer_sessions.revoked_at is null
          and customer_sessions.expires_at > transaction_timestamp()
      )
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('customer-identity:' || stale_customer.id::text, 0)
    );

    select customers.phone_hmac, customers.email_hmac
    into v_phone_hmac, v_email_hmac
    from public.customers
    where customers.id = stale_customer.id
    for update;

    update public.customers as target
    set auth_user_id = null,
        email = 'erased+' || replace(stale_customer.id::text, '-', '') || '@privacy.invalid',
        email_hmac = null,
        email_verified_at = null,
        full_name = null,
        date_of_birth = null,
        phone_hmac = null,
        phone_ciphertext = null,
        phone_last4 = null,
        phone_country = null,
        phone_verified_at = null,
        updated_at = now()
    where target.id = stale_customer.id
      and target.updated_at < p_cutoff
      and coalesce(target.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = stale_customer.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = stale_customer.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = stale_customer.id
          and stamp_events.created_at >= p_cutoff
      )
      and not exists (
        select 1 from public.customer_sessions
        where customer_sessions.customer_id = stale_customer.id
          and customer_sessions.revoked_at is null
          and customer_sessions.expires_at > transaction_timestamp()
      );

    if not found then
      continue;
    end if;

    update public.customer_sessions
    set revoked_at = now()
    where customer_id = stale_customer.id
      and revoked_at is null;

    update public.push_subscriptions
    set enabled = false,
        revoked_at = coalesce(revoked_at, now()),
        updated_at = now()
    where customer_id = stale_customer.id;

    update public.notification_events
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now(),
        metadata = metadata || jsonb_build_object('cancelled_reason', 'customer_erased')
    where customer_id = stale_customer.id
      and status in ('queued', 'delivering');

    update public.pending_reward_invites
    set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
        email_hmac = null,
        phone_hmac = null,
        email_masked = null,
        phone_last4 = null,
        claim_token_hash = 'scrubbed:' || id::text,
        updated_at = now()
    where matched_customer_id = stale_customer.id
       or attached_customer_id = stale_customer.id
       or (v_phone_hmac is not null and phone_hmac = v_phone_hmac)
       or (v_email_hmac is not null and email_hmac = v_email_hmac);

    purged_count := purged_count + 1;
  end loop;

  perform set_config('app.customer_erasure', '', true);
  return purged_count;
end;
$function$;

revoke execute on function public.admin_purge_stale_customer_pii(timestamp with time zone)
  from public, anon, authenticated;
grant execute on function public.admin_purge_stale_customer_pii(timestamp with time zone)
  to service_role;

-- Consent requests accept only the canonical support provenance contract.
create or replace function public.admin_record_consent_opt_out(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_source text,
  p_policy_version text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  admin_user_id uuid;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if p_channel not in ('email', 'sms', 'whatsapp') then
    raise exception 'Unsupported consent channel';
  end if;
  if p_source is distinct from 'support_request' then
    raise invalid_parameter_value using message = 'Invalid consent source';
  end if;
  if p_policy_version is distinct from '2026-07-19' then
    raise invalid_parameter_value using message = 'Invalid consent policy version';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'Opt-out reason is required';
  end if;
  if not exists (
    select 1 from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
  end if;

  insert into public.consent_records (
    merchant_id, customer_id, channel, consent_status, source, policy_version, metadata
  )
  values (
    p_merchant_id, p_customer_id, p_channel, 'opted_out', p_source, p_policy_version,
    jsonb_build_object('reason', trim(p_reason), 'admin_user_id', admin_user_id)
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, p_merchant_id, p_customer_id,
    'consent_records', p_customer_id, 'consent_opt_out_recorded',
    jsonb_build_object(
      'channel', p_channel,
      'source', p_source,
      'policy_version', p_policy_version,
      'reason', trim(p_reason)
    )
  );
end;
$function$;

revoke execute on function public.admin_record_consent_opt_out(uuid, uuid, text, text, text, text)
  from public, anon;
grant execute on function public.admin_record_consent_opt_out(uuid, uuid, text, text, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
