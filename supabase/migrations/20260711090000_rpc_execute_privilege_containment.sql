-- MS-db-emergency-containment — Blocker 1: contain SECURITY DEFINER RPC execution.
--
-- The initial schema granted table + function privileges to `authenticated`
-- broadly, and PostgreSQL's built-in default grants EXECUTE on every new
-- function to PUBLIC. The net effect: an ordinary logged-in user — or even an
-- anonymous caller — could execute privileged SECURITY DEFINER RPCs that move
-- money, anonymise customers, or drain the notification queue.
--
-- Strategy is revoke-then-allowlist, applied forward-only and re-runnably:
--   1. strip EXECUTE from PUBLIC / anon / authenticated on every public function,
--   2. harden default privileges so functions created later inherit the lockdown,
--   3. restore blanket EXECUTE to service_role (cron, webhooks, billing,
--      notifications, and the pre-auth customer flows all use the service client),
--   4. regrant EXECUTE to authenticated on a verified allowlist only: the RPCs
--      the app calls through the user-JWT client, plus the helper functions the
--      planner evaluates as the caller (RLS policies, a CHECK constraint, a
--      column default, and a view).
--   5. add a service-role self-guard to the most destructive RPC so a future
--      ACL regression cannot silently re-expose it.
--
-- Every statement is idempotent: revokes/grants are declarative and re-runnable,
-- and the function redefinition is CREATE OR REPLACE.

-- 1. Strip EXECUTE from the danger roles on all existing public functions.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

-- 2. Harden default privileges: functions created after this point (including in
-- later migrations) do not get EXECUTE handed to PUBLIC/anon/authenticated.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

-- 3. service_role keeps full EXECUTE — it is the trusted backend identity.
grant execute on all functions in schema public to service_role;

-- 4a. authenticated allowlist — RPCs invoked through the anon-key (user-JWT)
-- client. This set was derived by tracing every `.rpc(...)` call site to its
-- Supabase client factory; it is the complete list of functions a logged-in
-- merchant or admin session calls directly.
grant execute on function public.admin_adjust_membership_stamps(p_membership_id uuid, p_delta integer, p_reason text) to authenticated;
grant execute on function public.admin_cancel_reward(p_reward_id uuid, p_reason text) to authenticated;
grant execute on function public.admin_resolve_fraud_flag(p_fraud_flag_id uuid, p_status text, p_reason text) to authenticated;
grant execute on function public.admin_set_qr_active(p_qr_code_id uuid, p_is_active boolean, p_reason text) to authenticated;
grant execute on function public.admin_regenerate_qr_code(p_qr_code_id uuid, p_reason text) to authenticated;
grant execute on function public.admin_record_consent_opt_out(p_customer_id uuid, p_merchant_id uuid, p_channel text, p_source text, p_policy_version text, p_reason text) to authenticated;
grant execute on function public.admin_log_data_request(p_customer_id uuid, p_merchant_id uuid, p_request_type text, p_channel text, p_notes text) to authenticated;
grant execute on function public.admin_log_pilot_note(p_merchant_id uuid, p_note_type text, p_notes text, p_training_minutes integer) to authenticated;
grant execute on function public.save_loyalty_card(p_merchant_id uuid, p_card_id uuid, p_card_name text, p_stamps_required integer, p_reward_name text, p_reward_terms text, p_is_active boolean) to authenticated;
grant execute on function public.upsert_reward_pool_item(p_merchant_id uuid, p_loyalty_card_id uuid, p_reward_pool_item_id uuid, p_reward_name text, p_reward_terms text, p_weight integer, p_is_active boolean, p_display_order integer) to authenticated;
grant execute on function public.add_reward_pool_presets(p_merchant_id uuid, p_loyalty_card_id uuid, p_presets jsonb) to authenticated;
grant execute on function public.save_loyalty_card_birthday_reward(p_merchant_id uuid, p_loyalty_card_id uuid, p_enabled boolean, p_reward_name text, p_reward_terms text) to authenticated;
grant execute on function public.delete_reward_pool_item(p_merchant_id uuid, p_reward_pool_item_id uuid) to authenticated;
grant execute on function public.create_merchant_reward_invite(p_merchant_id uuid, p_email_hmac text, p_phone_hmac text, p_email_masked text, p_phone_last4 text, p_reward_name text, p_reward_terms text, p_personal_message text, p_reward_expires_after_days integer, p_claim_token_hash text) to authenticated;
grant execute on function public.issue_merchant_direct_reward(p_merchant_id uuid, p_membership_id uuid, p_reward_name text, p_reward_terms text, p_expires_in_days integer, p_reason text) to authenticated;
grant execute on function public.complete_merchant_onboarding(p_business_name text, p_business_type text, p_phone text, p_location_name text, p_address_line_1 text, p_address_line_2 text, p_address_city text, p_address_postcode text, p_address_provider text, p_address_provider_id text, p_address_source text, p_latitude double precision, p_longitude double precision, p_geofence_radius_meters integer, p_require_geofence boolean, p_soft_geofence_trigger_stamp_number integer, p_geofence_pin_source text) to authenticated;
grant execute on function public.create_or_get_join_qr(p_merchant_id uuid, p_loyalty_card_id uuid) to authenticated;
grant execute on function public.set_qr_active(p_merchant_id uuid, p_qr_code_id uuid, p_is_active boolean) to authenticated;

-- 4a-ii. Merchant self-service helpers that other governed specs pin as
-- authenticated-executable. Not called through .rpc() today, but each is
-- internally owner-scoped (create_merchant_onboarding enforces
-- p_owner_user_id = auth.uid(); assert_reward_pool_launch_ready is a read-only
-- launch guard) and already granted in production, so keeping them on the
-- allowlist preserves those contracts without widening the dangerous surface.
grant execute on function public.create_merchant_onboarding(p_owner_user_id uuid, p_email text, p_business_name text, p_business_slug text, p_business_type text, p_phone text, p_location_name text) to authenticated;
grant execute on function public.assert_reward_pool_launch_ready(p_merchant_id uuid, p_loyalty_card_id uuid, p_location_id uuid) to authenticated;

-- 4b. Caller-context helpers — the planner evaluates these AS the authenticated
-- caller during ordinary reads/writes, so they must stay executable or every
-- RLS SELECT/UPDATE and the affected INSERTs break. Enumerated from pg_policy,
-- pg_constraint (CHECK), pg_attrdef (column default), and the customers_masked
-- view.
grant execute on function public.is_internal_admin() to authenticated;
grant execute on function public.is_merchant_owner(target_merchant_id uuid) to authenticated;
grant execute on function public.is_customer_owner(target_customer_id uuid) to authenticated;
grant execute on function public.customer_has_membership(target_merchant_id uuid) to authenticated;
grant execute on function public.merchant_can_access_customer(target_customer_id uuid) to authenticated;
grant execute on function public.merchant_can_access_customer(target_merchant_id uuid, target_customer_id uuid) to authenticated;
grant execute on function public.owned_customer_ids() to authenticated;
grant execute on function public.owned_merchant_ids() to authenticated;
grant execute on function public.is_allowed_web_push_endpoint(p_endpoint text) to authenticated;
grant execute on function public.generate_membership_referral_code() to authenticated;

-- 5. Destructive-RPC self-guard. admin_purge_stale_customer_pii anonymises
-- customers using a caller-controlled cutoff; the ACL revoke above already
-- removes it from authenticated/anon, but we add an in-body service-role
-- assertion so a future misgrant cannot re-expose it. Body is otherwise the
-- current source definition, unchanged.
create or replace function public.admin_purge_stale_customer_pii(
  p_cutoff timestamp with time zone default (now() - '365 days'::interval)
)
returns integer
language plpgsql
security definer
set search_path to 'public'
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
  loop
    select phone_hmac, email_hmac
    into v_phone_hmac, v_email_hmac
    from public.customers
    where id = stale_customer.id;

    update public.customers
    set
      auth_user_id = null,
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
    where id = stale_customer.id;

    update public.pending_reward_invites
    set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
        email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
        claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
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

-- Re-assert the redefined function's ACL explicitly (CREATE OR REPLACE keeps
-- prior grants, but be belt-and-braces: never authenticated/anon/PUBLIC).
revoke execute on function public.admin_purge_stale_customer_pii(timestamp with time zone) from public, anon, authenticated;
grant execute on function public.admin_purge_stale_customer_pii(timestamp with time zone) to service_role;
