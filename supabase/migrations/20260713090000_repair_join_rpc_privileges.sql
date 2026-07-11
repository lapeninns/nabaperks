do $$
begin
  if to_regprocedure(
    'public.join_customer_membership_with_first_stamp(uuid,text,text,boolean,text,numeric,numeric,text)'
  ) is not null then
    revoke execute on function public.join_customer_membership_with_first_stamp(
      uuid, text, text, boolean, text, numeric, numeric, text
    ) from public, anon, authenticated;
    grant execute on function public.join_customer_membership_with_first_stamp(
      uuid, text, text, boolean, text, numeric, numeric, text
    ) to service_role;
  end if;

  if to_regprocedure(
    'public.issue_self_service_stamp(uuid,uuid,text,numeric,numeric,numeric,text,integer)'
  ) is not null then
    revoke execute on function public.issue_self_service_stamp(
      uuid, uuid, text, numeric, numeric, numeric, text, integer
    ) from public, anon, authenticated;
    grant execute on function public.issue_self_service_stamp(
      uuid, uuid, text, numeric, numeric, numeric, text, integer
    ) to service_role;
  end if;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select procedures.oid::regprocedure as signature
    from pg_proc procedures
    join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.prokind = 'f'
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      fn.signature
    );
    execute format(
      'grant execute on function %s to service_role',
      fn.signature
    );
  end loop;

  for fn in
    select procedures.oid::regprocedure as signature
    from pg_proc procedures
    join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.prokind = 'f'
      and procedures.proname = any(array[
        'admin_adjust_membership_stamps',
        'admin_cancel_reward',
        'admin_resolve_fraud_flag',
        'admin_set_qr_active',
        'admin_regenerate_qr_code',
        'admin_record_consent_opt_out',
        'admin_log_data_request',
        'admin_log_pilot_note',
        'save_loyalty_card',
        'upsert_reward_pool_item',
        'add_reward_pool_presets',
        'save_loyalty_card_birthday_reward',
        'delete_reward_pool_item',
        'create_merchant_reward_invite',
        'issue_merchant_direct_reward',
        'complete_merchant_onboarding',
        'create_or_get_join_qr',
        'set_qr_active',
        'customer_has_membership',
        'is_customer_owner',
        'is_internal_admin',
        'is_merchant_owner',
        'merchant_can_access_customer',
        'owned_customer_ids',
        'owned_merchant_ids',
        'is_allowed_web_push_endpoint',
        'generate_membership_referral_code',
        'create_merchant_onboarding',
        'assert_reward_pool_launch_ready'
      ])
  loop
    execute format(
      'grant execute on function %s to authenticated',
      fn.signature
    );
  end loop;
end;
$$;
