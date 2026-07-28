-- Admin privacy support for verified customers who have no membership.
--
-- Existing admin privacy RPCs deliberately require a customer/merchant
-- membership pair. Keep those signatures unchanged and add customer-scoped
-- variants for the service-role-only unaffiliated lookup. Every function
-- rechecks that the customer is verified and still has no membership while
-- holding a row lock, so a stale browser row cannot cross the scope boundary.
--
-- Account-wide consent evidence has no merchant tenant. consent_records already
-- retains a nullable customer reference for deletion evidence; merchant_id is
-- made nullable here so an explicit account-wide opt-out can be retained in the
-- same append-only ledger. Existing RLS policies remain safe: customer and admin
-- clauses are customer-scoped, while the merchant clause simply evaluates false
-- for NULL.

alter table public.consent_records
  alter column merchant_id drop not null;

comment on column public.consent_records.merchant_id is
  'Merchant scope for venue consent; NULL means account-wide consent recorded before any membership.';

create or replace function public.admin_record_unaffiliated_consent_opt_out(
  p_customer_id uuid,
  p_channel text,
  p_source text,
  p_policy_version text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_user_id uuid;
  v_customer_id uuid;
  v_consent_id uuid;
begin
  v_admin_user_id := (select auth.uid());

  if v_admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_channel not in ('email', 'sms', 'whatsapp', 'push') then
    raise exception 'Unsupported consent channel';
  end if;

  if length(trim(coalesce(p_source, ''))) < 3 then
    raise exception 'Consent source is required';
  end if;

  if length(trim(coalesce(p_policy_version, ''))) < 4 then
    raise exception 'Policy version is required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'Opt-out reason is required';
  end if;

  select customers.id
  into v_customer_id
  from public.customers
  where customers.id = p_customer_id
    and (
      customers.email_verified_at is not null
      or customers.phone_verified_at is not null
    )
    and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
    and not exists (
      select 1
      from public.customer_memberships
      where customer_memberships.customer_id = customers.id
    )
  for update;

  if v_customer_id is null then
    raise exception 'Verified unaffiliated customer context not found';
  end if;

  insert into public.consent_records (
    merchant_id,
    customer_id,
    channel,
    consent_status,
    source,
    policy_version,
    metadata
  )
  values (
    null,
    v_customer_id,
    p_channel,
    'opted_out',
    trim(p_source),
    trim(p_policy_version),
    jsonb_build_object(
      'reason', trim(p_reason),
      'admin_user_id', v_admin_user_id,
      'scope', 'account',
      'unaffiliated', true
    )
  )
  returning id into v_consent_id;

  insert into public.notification_preferences (
    customer_id,
    marketing_enabled
  )
  values (
    v_customer_id,
    false
  )
  on conflict (customer_id) do update
  set marketing_enabled = false;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    v_admin_user_id::text,
    null,
    v_customer_id,
    'consent_records',
    v_consent_id,
    'consent_opt_out_recorded',
    jsonb_build_object(
      'channel', p_channel,
      'source', trim(p_source),
      'policy_version', trim(p_policy_version),
      'reason', trim(p_reason),
      'scope', 'account',
      'unaffiliated', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'customer_id', v_customer_id,
    'consent_id', v_consent_id,
    'scope', 'account'
  );
end;
$$;

create or replace function public.admin_log_unaffiliated_data_request(
  p_customer_id uuid,
  p_request_type text,
  p_channel text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_user_id uuid;
  v_customer record;
  v_customer_json jsonb;
  v_pending_invite_json jsonb;
  v_consent_json jsonb;
  v_preferences_json jsonb;
  v_push_subscription_json jsonb;
  v_session_json jsonb;
  v_notification_json jsonb;
  v_product_event_json jsonb;
  v_loyalty_invitation_json jsonb;
  v_export_payload jsonb;
  v_surrogate_email text;
begin
  v_admin_user_id := (select auth.uid());

  if v_admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_request_type not in ('access', 'export', 'deletion', 'rectification') then
    raise exception 'Unsupported unaffiliated data request type';
  end if;

  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception 'Unsupported request channel';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Data request notes are required';
  end if;

  select customers.*
  into v_customer
  from public.customers
  where customers.id = p_customer_id
    and (
      customers.email_verified_at is not null
      or customers.phone_verified_at is not null
    )
    and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
    and not exists (
      select 1
      from public.customer_memberships
      where customer_memberships.customer_id = customers.id
    )
  for update;

  if v_customer.id is null then
    raise exception 'Verified unaffiliated customer context not found';
  end if;

  if p_request_type = 'export' then
    select to_jsonb(customer_row)
    into v_customer_json
    from (
      select
        id,
        auth_user_id,
        email,
        email_verified_at,
        full_name,
        date_of_birth,
        phone_last4,
        phone_country,
        phone_verified_at,
        created_at,
        updated_at
      from public.customers
      where id = v_customer.id
    ) as customer_row;

    select coalesce(
      jsonb_agg(to_jsonb(invite_row) order by invite_row.created_at),
      '[]'::jsonb
    )
    into v_pending_invite_json
    from (
      select
        id,
        merchant_id,
        status,
        email_masked,
        phone_last4,
        reward_name,
        reward_terms,
        personal_message,
        reward_expires_after_days,
        email_send_status,
        invite_expires_at,
        matched_customer_id,
        attached_customer_id,
        attached_membership_id,
        attached_reward_event_id,
        attached_at,
        created_at,
        updated_at
      from public.pending_reward_invites
      where matched_customer_id = v_customer.id
         or attached_customer_id = v_customer.id
         or (
           v_customer.phone_hmac is not null
           and phone_hmac = v_customer.phone_hmac
         )
         or (
           v_customer.email_hmac is not null
           and email_hmac = v_customer.email_hmac
         )
    ) as invite_row;

    select coalesce(
      jsonb_agg(to_jsonb(consent_row) order by consent_row.created_at),
      '[]'::jsonb
    )
    into v_consent_json
    from (
      select
        id,
        merchant_id,
        channel,
        consent_status,
        source,
        policy_version,
        created_at,
        metadata
      from public.consent_records
      where customer_id = v_customer.id
    ) as consent_row;

    select to_jsonb(preferences_row)
    into v_preferences_json
    from (
      select
        transactional_enabled,
        reminder_enabled,
        marketing_enabled,
        quiet_hours_start,
        quiet_hours_end,
        created_at,
        updated_at
      from public.notification_preferences
      where customer_id = v_customer.id
    ) as preferences_row;

    select coalesce(
      jsonb_agg(to_jsonb(subscription_row) order by subscription_row.created_at),
      '[]'::jsonb
    )
    into v_push_subscription_json
    from (
      select
        id,
        endpoint,
        user_agent,
        permission_state,
        enabled,
        revoked_at,
        last_seen_at,
        last_success_at,
        last_failure_at,
        failure_reason,
        metadata,
        created_at,
        updated_at
      from public.push_subscriptions
      where customer_id = v_customer.id
    ) as subscription_row;

    select coalesce(
      jsonb_agg(to_jsonb(session_row) order by session_row.created_at),
      '[]'::jsonb
    )
    into v_session_json
    from (
      select
        created_at,
        expires_at,
        last_seen_at,
        revoked_at
      from public.customer_sessions
      where customer_id = v_customer.id
    ) as session_row;

    select coalesce(
      jsonb_agg(to_jsonb(notification_row) order by notification_row.created_at),
      '[]'::jsonb
    )
    into v_notification_json
    from (
      select
        id,
        event_type,
        category,
        merchant_id,
        membership_id,
        reward_event_id,
        status,
        due_at,
        sent_at,
        cancelled_at,
        created_at,
        updated_at,
        metadata
      from public.notification_events
      where customer_id = v_customer.id
    ) as notification_row;

    select coalesce(
      jsonb_agg(to_jsonb(product_event_row) order by product_event_row.created_at),
      '[]'::jsonb
    )
    into v_product_event_json
    from (
      select
        id,
        event_name,
        merchant_id,
        membership_id,
        qr_code_id,
        actor_type,
        actor_id,
        created_at,
        metadata
      from public.product_events
      where customer_id = v_customer.id
    ) as product_event_row;

    select public.loyalty_invitations_export_for_customer(v_customer.id)
    into v_loyalty_invitation_json;

    v_export_payload := jsonb_build_object(
      'schema', 'nabaperks.customer-data-export.v1',
      'generated_at', now(),
      'customer', v_customer_json,
      'memberships', '[]'::jsonb,
      'stamp_events', '[]'::jsonb,
      'reward_events', '[]'::jsonb,
      'pending_reward_invites', v_pending_invite_json,
      'consent_records', v_consent_json,
      'notification_preferences', coalesce(v_preferences_json, 'null'::jsonb),
      'push_subscriptions', v_push_subscription_json,
      'customer_sessions', v_session_json,
      'notification_events', v_notification_json,
      'product_events', v_product_event_json,
      'loyalty_invitations', coalesce(v_loyalty_invitation_json, '[]'::jsonb)
    );

    insert into public.audit_logs (
      actor_type,
      actor_id,
      merchant_id,
      customer_id,
      target_table,
      target_id,
      action,
      metadata
    )
    values (
      'admin',
      v_admin_user_id::text,
      null,
      v_customer.id,
      'customers',
      v_customer.id,
      'customer_data_exported',
      jsonb_build_object(
        'request_type', 'export',
        'channel', p_channel,
        'notes', trim(p_notes),
        'export_schema', 'nabaperks.customer-data-export.v1',
        'scope', 'account',
        'unaffiliated', true,
        'consent_record_count', jsonb_array_length(v_consent_json),
        'notification_event_count', jsonb_array_length(v_notification_json),
        'product_event_count', jsonb_array_length(v_product_event_json)
      )
    );

    return v_export_payload;
  end if;

  if p_request_type = 'deletion' then
    perform public.admin_erase_loyalty_invitations_for_customer(v_customer.id);

    v_surrogate_email :=
      'erased+' || replace(v_customer.id::text, '-', '') || '@privacy.invalid';
    perform set_config('app.customer_erasure', 'true', true);

    update public.customers
    set
      auth_user_id = null,
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
      updated_at = now()
    where id = v_customer.id;

    perform set_config('app.customer_erasure', '', true);

    update public.customer_sessions
    set revoked_at = now()
    where customer_id = v_customer.id
      and revoked_at is null;

    update public.notification_preferences
    set marketing_enabled = false
    where customer_id = v_customer.id;

    update public.push_subscriptions
    set
      enabled = false,
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
    where customer_id = v_customer.id;

    update public.notification_events
    set
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now(),
      metadata = metadata || jsonb_build_object(
        'cancelled_reason',
        'customer_erased'
      )
    where customer_id = v_customer.id
      and status in ('queued', 'delivering');

    update public.pending_reward_invites
    set
      status = case
        when status in ('pending', 'matched') then 'cancelled'
        else status
      end,
      email_hmac = null,
      phone_hmac = null,
      email_masked = null,
      phone_last4 = null,
      claim_token_hash = 'scrubbed:' || id::text,
      updated_at = now()
    where matched_customer_id = v_customer.id
       or attached_customer_id = v_customer.id
       or (
         v_customer.phone_hmac is not null
         and phone_hmac = v_customer.phone_hmac
       )
       or (
         v_customer.email_hmac is not null
         and email_hmac = v_customer.email_hmac
       );

    insert into public.audit_logs (
      actor_type,
      actor_id,
      merchant_id,
      customer_id,
      target_table,
      target_id,
      action,
      metadata
    )
    values (
      'admin',
      v_admin_user_id::text,
      null,
      v_customer.id,
      'customers',
      v_customer.id,
      'customer_pii_erased',
      jsonb_build_object(
        'request_type', 'deletion',
        'channel', p_channel,
        'notes', trim(p_notes),
        'surrogate', v_surrogate_email,
        'scope', 'account',
        'unaffiliated', true,
        'ledger_retained', true
      )
    );

    return jsonb_build_object(
      'ok', true,
      'request_type', 'deletion',
      'customer_id', v_customer.id,
      'surrogate', v_surrogate_email,
      'scope', 'account',
      'ledger_retained', true
    );
  end if;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    v_admin_user_id::text,
    null,
    v_customer.id,
    'customers',
    v_customer.id,
    'data_request_logged',
    jsonb_build_object(
      'request_type', p_request_type,
      'channel', p_channel,
      'notes', trim(p_notes),
      'scope', 'account',
      'unaffiliated', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_type', p_request_type,
    'scope', 'account',
    'manual_follow_up_required', true
  );
end;
$$;

revoke all on function public.admin_record_unaffiliated_consent_opt_out(
  uuid, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_unaffiliated_consent_opt_out(
  uuid, text, text, text, text
) to authenticated, service_role;

revoke all on function public.admin_log_unaffiliated_data_request(
  uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_log_unaffiliated_data_request(
  uuid, text, text, text
) to authenticated, service_role;

notify pgrst, 'reload schema';
