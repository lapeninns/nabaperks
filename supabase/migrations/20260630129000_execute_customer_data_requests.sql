create or replace function public.prevent_verified_customer_contact_change()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.customer_erasure', true) = 'true' then
    return new;
  end if;

  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Customer auth user cannot be changed through profile updates';
  end if;

  if old.email_verified_at is not null then
    if new.email is distinct from old.email
      or new.email_verified_at is distinct from old.email_verified_at then
      raise exception 'Verified customer email cannot be changed';
    end if;
  end if;

  if old.phone_verified_at is not null then
    if new.phone is distinct from old.phone
      or new.phone_hmac is distinct from old.phone_hmac
      or new.phone_ciphertext is distinct from old.phone_ciphertext
      or new.phone_last4 is distinct from old.phone_last4
      or new.phone_country is distinct from old.phone_country
      or new.phone_verified_at is distinct from old.phone_verified_at then
      raise exception 'Verified customer phone cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.admin_export_customer_data(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  customer_json jsonb;
  membership_json jsonb;
  stamp_json jsonb;
  reward_json jsonb;
  consent_json jsonb;
  notification_json jsonb;
  product_event_json jsonb;
  export_payload jsonb;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception 'Unsupported request channel';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Data request notes are required';
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
  end if;

  select to_jsonb(customer_row)
  into customer_json
  from (
    select
      id,
      auth_user_id,
      email,
      email_verified_at,
      full_name,
      date_of_birth,
      phone,
      phone_last4,
      phone_country,
      phone_verified_at,
      created_at,
      updated_at
    from public.customers
    where id = p_customer_id
  ) as customer_row;

  if customer_json is null then
    raise exception 'Customer not found';
  end if;

  select coalesce(jsonb_agg(to_jsonb(membership_row) order by membership_row.created_at), '[]'::jsonb)
  into membership_json
  from (
    select
      id,
      merchant_id,
      current_stamp_count,
      total_stamps_earned,
      total_rewards_redeemed,
      last_visit_at,
      active_cycle_number,
      created_at,
      updated_at
    from public.customer_memberships
    where customer_id = p_customer_id
  ) as membership_row;

  select coalesce(jsonb_agg(to_jsonb(stamp_row) order by stamp_row.created_at), '[]'::jsonb)
  into stamp_json
  from (
    select
      id,
      merchant_id,
      membership_id,
      loyalty_card_id,
      location_id,
      event_type,
      stamps_delta,
      created_at,
      metadata
    from public.stamp_events
    where customer_id = p_customer_id
  ) as stamp_row;

  select coalesce(jsonb_agg(to_jsonb(reward_row) order by reward_row.created_at), '[]'::jsonb)
  into reward_json
  from (
    select
      id,
      merchant_id,
      membership_id,
      loyalty_card_id,
      status,
      reward_name,
      reward_terms,
      cycle_number,
      redeemable_from,
      expires_at,
      redeemed_at,
      expired_at,
      created_at,
      updated_at,
      metadata
    from public.reward_events
    where customer_id = p_customer_id
  ) as reward_row;

  select coalesce(jsonb_agg(to_jsonb(consent_row) order by consent_row.created_at), '[]'::jsonb)
  into consent_json
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
    where customer_id = p_customer_id
  ) as consent_row;

  select coalesce(jsonb_agg(to_jsonb(notification_row) order by notification_row.created_at), '[]'::jsonb)
  into notification_json
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
      created_at,
      updated_at,
      metadata
    from public.notification_events
    where customer_id = p_customer_id
  ) as notification_row;

  select coalesce(jsonb_agg(to_jsonb(product_event_row) order by product_event_row.created_at), '[]'::jsonb)
  into product_event_json
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
    where customer_id = p_customer_id
  ) as product_event_row;

  export_payload := jsonb_build_object(
    'schema', 'nabaperks.customer-data-export.v1',
    'generated_at', now(),
    'customer', customer_json,
    'memberships', membership_json,
    'stamp_events', stamp_json,
    'reward_events', reward_json,
    'consent_records', consent_json,
    'notification_events', notification_json,
    'product_events', product_event_json
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
    admin_user_id::text,
    p_merchant_id,
    p_customer_id,
    'customers',
    p_customer_id,
    'customer_data_exported',
    jsonb_build_object(
      'request_type', 'export',
      'channel', p_channel,
      'notes', trim(p_notes),
      'export_schema', 'nabaperks.customer-data-export.v1',
      'membership_count', jsonb_array_length(membership_json),
      'stamp_event_count', jsonb_array_length(stamp_json),
      'reward_event_count', jsonb_array_length(reward_json),
      'consent_record_count', jsonb_array_length(consent_json),
      'notification_event_count', jsonb_array_length(notification_json),
      'product_event_count', jsonb_array_length(product_event_json)
    )
  );

  return export_payload;
end;
$$;

create or replace function public.admin_erase_customer_pii(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  surrogate_email text;
  erased_count integer;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception 'Unsupported request channel';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Data request notes are required';
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
  end if;

  surrogate_email := 'erased+' || replace(p_customer_id::text, '-', '') || '@privacy.invalid';
  perform set_config('app.customer_erasure', 'true', true);

  update public.customers
  set
    auth_user_id = null,
    email = surrogate_email,
    email_verified_at = null,
    full_name = null,
    date_of_birth = null,
    phone = null,
    phone_hmac = null,
    phone_ciphertext = null,
    phone_last4 = null,
    phone_country = null,
    phone_verified_at = null,
    updated_at = now()
  where id = p_customer_id;

  get diagnostics erased_count = row_count;
  perform set_config('app.customer_erasure', '', true);

  if erased_count <> 1 then
    raise exception 'Customer not found';
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
    admin_user_id::text,
    p_merchant_id,
    p_customer_id,
    'customers',
    p_customer_id,
    'customer_pii_erased',
    jsonb_build_object(
      'request_type', 'deletion',
      'channel', p_channel,
      'notes', trim(p_notes),
      'surrogate', surrogate_email,
      'ledger_retained', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_type', 'deletion',
    'customer_id', p_customer_id,
    'surrogate', surrogate_email,
    'ledger_retained', true
  );
end;
$$;

create or replace function public.admin_purge_stale_customer_pii(
  p_cutoff timestamptz default now() - interval '365 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_customer record;
  purged_count integer := 0;
begin
  perform set_config('app.customer_erasure', 'true', true);

  for stale_customer in
    select customers.id
    from public.customers
    where customers.updated_at < p_cutoff
      and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1
        from public.customer_memberships
        where customer_memberships.customer_id = customers.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1
        from public.reward_events
        where reward_events.customer_id = customers.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1
        from public.stamp_events
        where stamp_events.customer_id = customers.id
          and stamp_events.created_at >= p_cutoff
      )
  loop
    update public.customers
    set
      auth_user_id = null,
      email = 'erased+' || replace(stale_customer.id::text, '-', '') || '@privacy.invalid',
      email_verified_at = null,
      full_name = null,
      date_of_birth = null,
      phone = null,
      phone_hmac = null,
      phone_ciphertext = null,
      phone_last4 = null,
      phone_country = null,
      phone_verified_at = null,
      updated_at = now()
    where id = stale_customer.id;

    purged_count := purged_count + 1;
  end loop;

  perform set_config('app.customer_erasure', '', true);
  return purged_count;
end;
$$;

drop function if exists public.admin_log_data_request(uuid, uuid, text, text, text);

create or replace function public.admin_log_data_request(
  p_customer_id uuid,
  p_merchant_id uuid,
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
  admin_user_id uuid;
begin
  if p_request_type = 'export' then
    return public.admin_export_customer_data(
      p_customer_id,
      p_merchant_id,
      p_channel,
      p_notes
    );
  end if;

  if p_request_type = 'deletion' then
    return public.admin_erase_customer_pii(
      p_customer_id,
      p_merchant_id,
      p_channel,
      p_notes
    );
  end if;

  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_request_type not in ('access', 'rectification', 'consent') then
    raise exception 'Unsupported data request type';
  end if;

  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception 'Unsupported request channel';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Data request notes are required';
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
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
    admin_user_id::text,
    p_merchant_id,
    p_customer_id,
    'customers',
    p_customer_id,
    'data_request_logged',
    jsonb_build_object(
      'request_type', p_request_type,
      'channel', p_channel,
      'notes', trim(p_notes)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_type', p_request_type,
    'manual_follow_up_required', true
  );
end;
$$;

grant execute on function public.admin_export_customer_data(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_erase_customer_pii(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_purge_stale_customer_pii(timestamptz) to service_role;
grant execute on function public.admin_log_data_request(uuid, uuid, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
