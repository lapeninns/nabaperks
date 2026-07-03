-- Issued rewards, phase 1: GDPR export completeness.
--
-- admin_export_customer_data (Art. 15 subject access) must carry every stored
-- field. Reproduced verbatim from 20260630129000 with `source` and
-- `birthday_year` added to the reward_events projection — birthday_year is
-- derived from the customer's date of birth, so it is personal data the export
-- must include.

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
      source,
      birthday_year,
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

grant execute on function public.admin_export_customer_data(uuid, uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
