create table public.personal_data_relation_manifest (
  relation_name text primary key,
  relation_state text not null check (relation_state in ('live', 'non_live')),
  subject_linkage text not null,
  disposition text not null check (disposition in ('included', 'excluded')),
  export_section text,
  export_projection text[],
  erase_action text not null,
  reason_code text not null,
  test_fixture_key text,
  constraint personal_data_relation_manifest_name_check
    check (relation_name ~ '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$'),
  constraint personal_data_relation_manifest_export_check check (
    (disposition = 'included'
      and relation_state = 'live'
      and export_section is not null
      and cardinality(export_projection) > 0
      and reason_code = 'data_subject_access')
    or
    (disposition = 'excluded'
      and export_section is null
      and export_projection is null
      and reason_code in (
        'security_credential_store',
        'subject_identifier_unresolvable',
        'relation_non_live'
      ))
  )
);

create unique index personal_data_relation_manifest_export_section_idx
  on public.personal_data_relation_manifest (export_section)
  where export_section is not null;

insert into public.personal_data_relation_manifest (
  relation_name, relation_state, subject_linkage, disposition, export_section,
  export_projection, erase_action, reason_code, test_fixture_key
)
values
  ('public.audit_logs', 'live', 'customer_id', 'included', 'audit_logs', array['id','actor_type','actor_id','merchant_id','customer_id','target_table','target_id','action','metadata','created_at'], 'retain_minimise_subject_rows', 'data_subject_access', 'audit_log'),
  ('public.consent_records', 'live', 'customer_id', 'included', 'consent_records', array['id','merchant_id','customer_id','channel','consent_status','source','policy_version','created_at','metadata'], 'retain_consent_ledger', 'data_subject_access', 'consent'),
  ('public.customer_join_stamp_recoveries', 'live', 'customer_id', 'included', 'customer_join_stamp_recoveries', array['membership_id','customer_id','merchant_id','qr_id','reason','resolution','status','attempt_count','failed_at','last_attempt_at','retry_until','resolved_at','updated_at'], 'delete_subject_rows', 'data_subject_access', 'join_recovery'),
  ('public.customer_loyalty_terms_acceptances', 'live', 'customer_id', 'included', 'customer_loyalty_terms_acceptances', array['id','membership_id','customer_id','merchant_id','loyalty_card_id','qr_code_id','policy_version','source','terms_snapshot','terms_sha256','accepted_at'], 'retain_terms_ledger', 'data_subject_access', 'terms_acceptance'),
  ('public.customer_memberships', 'live', 'customer_id', 'included', 'customer_memberships', array['id','merchant_id','customer_id','current_stamp_count','total_stamps_earned','total_rewards_redeemed','last_visit_at','created_at','updated_at','active_cycle_number','referral_code','referral_code_active','referral_code_rotated_at','referral_code_admin_disabled_at','total_rewards_expired'], 'retain_loyalty_ledger', 'data_subject_access', 'membership'),
  ('public.customer_sessions', 'live', 'customer_id', 'included', 'customer_sessions', array['id','customer_id','created_at','expires_at','last_seen_at','revoked_at'], 'delete_subject_rows', 'data_subject_access', 'customer_session'),
  ('public.customers', 'live', 'customer_row', 'included', 'customers', array['id','auth_user_id','email','created_at','updated_at','phone_last4','phone_country','phone_verified_at','full_name','date_of_birth','email_verified_at'], 'anonymise_subject_row', 'data_subject_access', 'customer'),
  ('public.fraud_flags', 'live', 'customer_id', 'included', 'fraud_flags', array['id','merchant_id','customer_id','membership_id','signal','severity','status','metadata','created_at','updated_at'], 'retain_minimise_subject_rows', 'data_subject_access', 'fraud_flag'),
  ('public.loyalty_invite_recipients', 'live', 'claimed_customer_id', 'included', 'loyalty_invite_recipients', array['id','campaign_id','merchant_id','email_masked','status','attempt_count','next_attempt_at','provider_message_id','failure_reason','sent_at','delivered_at','opened_at','joined_at','failed_at','unsubscribed_at','expired_at','claimed_customer_id','claimed_membership_id','created_at','updated_at'], 'redact_subject_rows', 'data_subject_access', 'loyalty_invite'),
  ('public.notification_deliveries', 'live', 'customer_id', 'included', 'notification_deliveries', array['id','notification_event_id','customer_id','status','attempt_number','response_status','failure_reason','attempted_at','sent_at','metadata','created_at'], 'retain_minimise_subject_rows', 'data_subject_access', 'notification_delivery'),
  ('public.notification_events', 'live', 'customer_id', 'included', 'notification_events', array['id','event_type','category','customer_id','merchant_id','membership_id','reward_event_id','cycle_number','business_date','due_at','dedupe_key','status','payload','metadata','created_at','sent_at','cancelled_at','updated_at'], 'retain_minimise_subject_rows', 'data_subject_access', 'notification_event'),
  ('public.notification_preferences', 'live', 'customer_id', 'included', 'notification_preferences', array['customer_id','transactional_enabled','reminder_enabled','marketing_enabled','quiet_hours_start','quiet_hours_end','created_at','updated_at'], 'delete_subject_rows', 'data_subject_access', 'notification_preference'),
  ('public.offer_campaign_claims', 'live', 'customer_id', 'included', 'offer_campaign_claims', array['id','campaign_id','merchant_id','customer_id','membership_id','bonus_stamps_awarded','claimed_at'], 'retain_loyalty_ledger', 'data_subject_access', 'offer_claim'),
  ('public.offer_discount_entitlements', 'live', 'customer_id', 'included', 'offer_discount_entitlements', array['id','claim_id','campaign_id','merchant_id','customer_id','membership_id','discount_percent','requires_id_check','extra_terms','status','valid_from','valid_to','created_at','updated_at'], 'retain_loyalty_ledger', 'data_subject_access', 'offer_entitlement'),
  ('public.offer_pass_scan_tokens', 'live', 'customer_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'offer_scan_token'),
  ('public.offer_redemptions', 'live', 'customer_id', 'included', 'offer_redemptions', array['id','entitlement_id','campaign_id','merchant_id','customer_id','membership_id','discount_percent','id_check_attested','no_stacking_attested','redeemed_by_user_id','redeemed_at'], 'retain_loyalty_ledger', 'data_subject_access', 'offer_redemption'),
  ('public.pending_reward_invites', 'live', 'matched_or_attached_customer_id', 'included', 'pending_reward_invites', array['id','merchant_id','created_by_user_id','email_masked','phone_last4','reward_name','reward_terms','personal_message','reward_expires_after_days','status','matched_customer_id','attached_customer_id','attached_membership_id','attached_reward_event_id','attached_at','email_send_status','invite_expires_at','created_at','updated_at'], 'redact_subject_rows', 'data_subject_access', 'reward_invite'),
  ('public.product_events', 'live', 'customer_id', 'included', 'product_events', array['id','event_name','merchant_id','customer_id','membership_id','qr_code_id','actor_type','actor_id','metadata','created_at','occurred_at'], 'retain_minimise_subject_rows', 'data_subject_access', 'product_event'),
  ('public.push_subscriptions', 'live', 'customer_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'push_subscription'),
  ('public.referrals', 'live', 'referral_customer_id', 'included', 'referrals', array['id','referred_membership_id','referrer_membership_id','referral_code_used','created_at','referrer_bonus_due_at','referrer_bonus_awarded_at','referrer_stamp_event_id','status','venue_id','referrer_customer_id','referred_customer_id','qualified_at','qualifying_stamp_id','hold_reason','held_at','next_retry_at','retry_count','last_error','updated_at'], 'retain_loyalty_ledger', 'data_subject_access', 'referral'),
  ('public.reward_events', 'live', 'customer_id', 'included', 'reward_events', array['id','merchant_id','customer_id','membership_id','loyalty_card_id','status','cancelled_reason','created_at','redeemed_at','updated_at','metadata','reward_pool_item_id','reward_name','reward_terms','redeemable_from','cycle_number','expires_at','expired_at','source','birthday_year'], 'retain_loyalty_ledger', 'data_subject_access', 'reward_event'),
  ('public.reward_scan_tokens', 'live', 'customer_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'reward_scan_token'),
  ('public.stamp_events', 'live', 'customer_id', 'included', 'stamp_events', array['id','merchant_id','customer_id','membership_id','loyalty_card_id','location_id','event_type','stamps_delta','created_at','metadata','earned_business_date','cycle_number'], 'retain_loyalty_ledger', 'data_subject_access', 'stamp_event'),
  ('public.loyalty_invite_email_suppressions', 'live', 'email_hmac_one_way', 'excluded', null, null, 'erase_by_prior_identifier', 'subject_identifier_unresolvable', null),
  ('public.reward_invite_email_suppressions', 'live', 'email_hmac_one_way', 'excluded', null, null, 'erase_by_prior_identifier', 'subject_identifier_unresolvable', null),
  ('public.customer_reward_email_assurances', 'non_live', 'historical_dropped_relation', 'excluded', null, null, 'none_relation_absent', 'relation_non_live', null),
  ('auth.users', 'live', 'auth_user_row', 'included', 'auth_users', array['id','aud','role','email','email_confirmed_at','invited_at','last_sign_in_at','raw_user_meta_data','created_at','updated_at','phone','phone_confirmed_at','confirmed_at','is_sso_user','deleted_at','is_anonymous'], 'scrub_subject_identity', 'data_subject_access', 'auth_user'),
  ('auth.identities', 'live', 'auth_user_id', 'included', 'auth_identities', array['id','user_id','provider_id','identity_data','provider','last_sign_in_at','created_at','updated_at','email'], 'delete_subject_rows', 'data_subject_access', 'auth_identity'),
  ('auth.oauth_consents', 'live', 'auth_user_id', 'included', 'auth_oauth_consents', array['id','user_id','client_id','scopes','granted_at','revoked_at'], 'delete_subject_rows', 'data_subject_access', 'auth_oauth_consent'),
  ('auth.sessions', 'live', 'auth_user_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_session'),
  ('auth.refresh_tokens', 'live', 'auth_user_id_text', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_refresh_token'),
  ('auth.one_time_tokens', 'live', 'auth_user_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_one_time_token'),
  ('auth.flow_state', 'live', 'auth_user_or_linking_target', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_flow_state'),
  ('auth.mfa_factors', 'live', 'auth_user_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_mfa_factor'),
  ('auth.mfa_challenges', 'live', 'auth_factor_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_mfa_challenge'),
  ('auth.mfa_amr_claims', 'live', 'auth_session_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_mfa_amr_claim'),
  ('auth.oauth_authorizations', 'live', 'auth_user_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_oauth_authorization'),
  ('auth.webauthn_challenges', 'live', 'auth_user_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_webauthn_challenge'),
  ('auth.webauthn_credentials', 'live', 'auth_user_id', 'excluded', null, null, 'delete_subject_rows', 'security_credential_store', 'auth_webauthn_credential'),
  ('auth.audit_log_entries', 'live', 'payload_unresolvable', 'excluded', null, null, 'retain_provider_audit', 'subject_identifier_unresolvable', null);

revoke all on table public.personal_data_relation_manifest from public, anon, authenticated;
grant select on table public.personal_data_relation_manifest to service_role;

create or replace function public.admin_export_customer_data(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid := (select auth.uid());
  v_auth_user_id uuid;
  v_bad_relation text;
  v_export_sql text;
  v_manifest jsonb;
  v_sections jsonb;
  v_snapshot_id uuid := gen_random_uuid();
  v_payload jsonb;
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
  if length(btrim(coalesce(p_notes, ''))) < 4 then
    raise exception using message = 'Data request notes are required';
  end if;

  select customers.auth_user_id
  into v_auth_user_id
  from public.customers
  join public.customer_memberships
    on customer_memberships.customer_id = customers.id
  where customers.id = p_customer_id
    and customer_memberships.merchant_id = p_merchant_id;

  if not found then
    raise exception using message = 'Customer membership context not found';
  end if;

  select manifest.relation_name
  into v_bad_relation
  from public.personal_data_relation_manifest manifest
  where (manifest.relation_state = 'live' and to_regclass(manifest.relation_name) is null)
     or (manifest.relation_state = 'non_live' and to_regclass(manifest.relation_name) is not null)
     or (manifest.disposition = 'included' and exists (
       select 1
       from unnest(manifest.export_projection) projection(column_name)
       where not exists (
         select 1
         from pg_attribute attribute
         where attribute.attrelid = to_regclass(manifest.relation_name)
           and attribute.attname = projection.column_name
           and attribute.attnum > 0
           and not attribute.attisdropped
       )
     ))
  order by manifest.relation_name
  limit 1;

  if v_bad_relation is not null then
    raise exception using message = 'Personal data manifest is stale';
  end if;

  select relation.relation_name
  into v_bad_relation
  from (
    select 'public.customers' as relation_name
    union
    select distinct format('public.%I', columns.table_name) as relation_name
    from information_schema.columns columns
    join information_schema.tables tables
      on tables.table_schema = columns.table_schema
     and tables.table_name = columns.table_name
     and tables.table_type = 'BASE TABLE'
    where columns.table_schema = 'public'
      and columns.column_name in (
        'customer_id', 'claimed_customer_id', 'matched_customer_id',
        'attached_customer_id', 'referrer_customer_id', 'referred_customer_id'
      )
  ) relation
  where not exists (
    select 1
    from public.personal_data_relation_manifest manifest
    where manifest.relation_name = relation.relation_name
      and manifest.relation_state = 'live'
  )
  order by relation.relation_name
  limit 1;

  if v_bad_relation is not null then
    raise exception using message = 'Personal data manifest is incomplete';
  end if;

  select string_agg(
    format(
      'select %L as section_name, coalesce((select jsonb_agg(to_jsonb(export_row) order by to_jsonb(export_row)::text) from (select %s from %I.%I source_row where %s) export_row), ''[]''::jsonb) as rows',
      manifest.export_section,
      projection.columns,
      split_part(manifest.relation_name, '.', 1),
      split_part(manifest.relation_name, '.', 2),
      case manifest.subject_linkage
        when 'customer_id' then 'source_row.customer_id = $1'
        when 'customer_row' then 'source_row.id = $1'
        when 'claimed_customer_id' then 'source_row.claimed_customer_id = $1'
        when 'matched_or_attached_customer_id' then '(source_row.matched_customer_id = $1 or source_row.attached_customer_id = $1)'
        when 'referral_customer_id' then '(source_row.referrer_customer_id = $1 or source_row.referred_customer_id = $1)'
        when 'auth_user_row' then 'source_row.id = $2'
        when 'auth_user_id' then 'source_row.user_id = $2'
        else null
      end
    ),
    ' union all '
    order by manifest.relation_name
  )
  into v_export_sql
  from public.personal_data_relation_manifest manifest
  cross join lateral (
    select string_agg(format('%I', item.column_name), ', ' order by item.ordinality) as columns
    from unnest(manifest.export_projection) with ordinality item(column_name, ordinality)
  ) projection
  where manifest.disposition = 'included';

  if v_export_sql is null or position('where )' in v_export_sql) > 0 then
    raise exception using message = 'Personal data manifest has unsupported subject linkage';
  end if;

  execute format(
    'select
       (select jsonb_agg(to_jsonb(manifest) order by manifest.relation_name)
        from public.personal_data_relation_manifest manifest),
       jsonb_object_agg(exported.section_name, jsonb_build_object(''snapshot_id'', %L, ''rows'', exported.rows))
     from (%s) exported',
    v_snapshot_id,
    v_export_sql
  )
  using p_customer_id, v_auth_user_id
  into v_manifest, v_sections;

  if v_sections is null
    or (select count(*) from jsonb_object_keys(v_sections)) <>
      (select count(*) from public.personal_data_relation_manifest where disposition = 'included') then
    raise exception using message = 'Personal data export sections are incomplete';
  end if;

  v_payload := jsonb_build_object(
    'schema', 'nabaperks.customer-data-export.v2',
    'generated_at', statement_timestamp(),
    'snapshot_id', v_snapshot_id,
    'manifest_snapshot_id', v_snapshot_id,
    'manifest', v_manifest,
    'sections', v_sections
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id,
    action, metadata
  ) values (
    'admin', v_admin_user_id::text, p_merchant_id, p_customer_id, 'customers',
    p_customer_id, 'customer_data_exported',
    jsonb_build_object(
      'request_type', 'export',
      'channel', p_channel,
      'export_schema', 'nabaperks.customer-data-export.v2',
      'snapshot_id', v_snapshot_id,
      'manifest_relation_count', jsonb_array_length(v_manifest),
      'export_section_count', (select count(*) from jsonb_object_keys(v_sections))
    )
  );

  return v_payload;
end;
$$;

revoke all on function public.admin_export_customer_data(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_export_customer_data(uuid, uuid, text, text)
  to authenticated;
