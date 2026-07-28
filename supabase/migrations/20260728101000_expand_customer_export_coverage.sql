-- Extend the established customer export without changing its public RPC
-- signature. The existing implementation remains the audited base operation;
-- this wrapper adds later customer-linked tables while deliberately excluding
-- push endpoints, encryption keys, session identifiers, counterparty customer
-- identifiers, provider payloads, and internal fraud/audit material.

alter function public.admin_export_customer_data(uuid, uuid, text, text)
  rename to admin_export_customer_data_base_v1;

revoke all on function public.admin_export_customer_data_base_v1(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

create function public.admin_export_customer_data(
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
  export_payload jsonb;
  preference_json jsonb;
  session_json jsonb;
  terms_json jsonb;
  push_json jsonb;
  delivery_json jsonb;
  referral_json jsonb;
begin
  export_payload := public.admin_export_customer_data_base_v1(
    p_customer_id,
    p_merchant_id,
    p_channel,
    p_notes
  );

  select coalesce(to_jsonb(preference_row), '{}'::jsonb)
  into preference_json
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
    where customer_id = p_customer_id
  ) as preference_row;

  preference_json := coalesce(preference_json, '{}'::jsonb);

  select coalesce(
    jsonb_agg(to_jsonb(session_row) order by session_row.created_at),
    '[]'::jsonb
  )
  into session_json
  from (
    select
      created_at,
      expires_at,
      last_seen_at,
      revoked_at
    from public.customer_sessions
    where customer_id = p_customer_id
  ) as session_row;

  select coalesce(
    jsonb_agg(to_jsonb(terms_row) order by terms_row.accepted_at),
    '[]'::jsonb
  )
  into terms_json
  from (
    select
      id,
      membership_id,
      merchant_id,
      loyalty_card_id,
      qr_code_id,
      policy_version,
      source,
      terms_snapshot,
      terms_sha256,
      accepted_at
    from public.customer_loyalty_terms_acceptances
    where customer_id = p_customer_id
  ) as terms_row;

  select coalesce(
    jsonb_agg(to_jsonb(push_row) order by push_row.created_at),
    '[]'::jsonb
  )
  into push_json
  from (
    select
      id,
      user_agent,
      permission_state,
      enabled,
      revoked_at,
      last_seen_at,
      last_success_at,
      last_failure_at,
      failure_reason,
      created_at,
      updated_at
    from public.push_subscriptions
    where customer_id = p_customer_id
  ) as push_row;

  select coalesce(
    jsonb_agg(to_jsonb(delivery_row) order by delivery_row.created_at),
    '[]'::jsonb
  )
  into delivery_json
  from (
    select
      id,
      notification_event_id,
      status,
      attempt_number,
      response_status,
      failure_reason,
      attempted_at,
      sent_at,
      created_at
    from public.notification_deliveries
    where customer_id = p_customer_id
  ) as delivery_row;

  select coalesce(
    jsonb_agg(to_jsonb(referral_row) order by referral_row.created_at),
    '[]'::jsonb
  )
  into referral_json
  from (
    select
      referrals.id,
      case
        when referrals.referrer_customer_id = p_customer_id then 'referrer'
        else 'referred'
      end as customer_role,
      referrals.venue_id,
      case
        when referrals.referrer_customer_id = p_customer_id
          then referrals.referrer_membership_id
        else referrals.referred_membership_id
      end as membership_id,
      referrals.status,
      referrals.qualified_at,
      referrals.referrer_bonus_due_at,
      referrals.referrer_bonus_awarded_at,
      referrals.hold_reason,
      referrals.held_at,
      referrals.next_retry_at,
      referrals.retry_count,
      referrals.created_at,
      referrals.updated_at
    from public.referrals
    where referrals.referrer_customer_id = p_customer_id
       or referrals.referred_customer_id = p_customer_id
  ) as referral_row;

  return export_payload || jsonb_build_object(
    'notification_preferences', preference_json,
    'customer_sessions', session_json,
    'loyalty_terms_acceptances', terms_json,
    'push_subscriptions', push_json,
    'notification_deliveries', delivery_json,
    'referrals', referral_json
  );
end;
$$;

revoke all on function public.admin_export_customer_data(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.admin_export_customer_data(uuid, uuid, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
