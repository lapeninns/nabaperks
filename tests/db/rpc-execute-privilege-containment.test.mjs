import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db emergency containment — Blocker 1: privileged RPCs are callable by
 * ordinary users.
 *
 * The initial schema granted `execute` on functions broadly (and Supabase's
 * default `create function` grants `execute` to PUBLIC), so an `authenticated`
 * session — or even `anon` — can call SECURITY DEFINER RPCs that move money,
 * anonymise customers, or drain the notification queue.
 *
 * The fix is revoke-then-allowlist: strip `execute` from PUBLIC/anon/
 * authenticated, harden default privileges, regrant everything to
 * `service_role`, and regrant to `authenticated` only the functions the app
 * calls through the user-JWT client plus the helpers RLS policies / CHECK
 * constraints / column defaults / views evaluate in the caller's context.
 *
 * These assertions prove the resulting ACL directly from the catalog, so they
 * are the executable definition of the allowlist.
 */

// Group A — RPCs the app invokes through the anon-key (user-JWT) client.
// Confirmed by tracing every `.rpc(...)` call site to its client factory.
const AUTHENTICATED_DIRECT_RPCS = [
  "current_auth_session_is_passwordless",
  "can_bootstrap_admin_webauthn",
  "admin_adjust_membership_stamps",
  "admin_cancel_reward",
  "admin_confirm_merchant_launch_delivered",
  "admin_resolve_fraud_flag",
  "admin_mark_merchant_launch_dispatched",
  "admin_set_qr_active",
  "admin_set_merchant_launch_pilot_extension",
  "admin_regenerate_qr_code",
  "admin_record_consent_opt_out",
  "admin_log_data_request",
  "admin_erase_loyalty_invitations_for_customer",
  "loyalty_invitations_export_for_customer",
  "admin_erase_offer_claims_for_customer",
  "offer_claims_export_for_customer",
  "admin_log_pilot_note",
  "admin_capture_commercial_evidence_case",
  "admin_verify_customer_date_of_birth",
  "save_loyalty_card",
  "upsert_reward_pool_item",
  "set_reward_pool_item_active",
  "add_reward_pool_presets",
  "save_loyalty_card_birthday_reward",
  "delete_reward_pool_item",
  "create_bounded_merchant_reward_invite",
  "issue_merchant_direct_reward",
  "complete_merchant_onboarding",
  "create_or_get_join_qr",
  "set_qr_active",
  "record_merchant_cancellation_interview",
  "redeem_self_service_reward",
]

// Group B — functions the planner evaluates AS the authenticated caller during
// ordinary DML: RLS policy helpers, a CHECK-constraint validator, a column
// default, and view-embedded helpers. Revoking any of these breaks normal
// authenticated reads/writes, so they stay on the allowlist.
const AUTHENTICATED_CALLER_CONTEXT = [
  "customer_has_membership",
  "is_customer_owner",
  "is_internal_admin",
  "is_merchant_owner",
  "merchant_can_access_customer",
  "owned_customer_ids",
  "owned_merchant_ids",
  "is_allowed_web_push_endpoint",
  "generate_membership_referral_code",
  // Lets the admin console read its OWN MFA-enrolment state authoritatively;
  // the session cookie's factor list is stale for pre-enrolment sessions.
  // Discloses nothing about any other user (it is bound to auth.uid()).
  "viewer_has_verified_mfa_factor",
  "viewer_has_activated_admin_mfa",
]

// Merchant self-service helpers other governed specs pin as
// authenticated-executable (onboarding transaction, reward-preset atomic add).
// Not `.rpc()`-called today, but internally owner-scoped / read-only and
// already granted in production, so they stay to preserve those contracts.
const SPEC_PINNED_SELF_SERVICE = ["assert_reward_pool_launch_ready"]

const AUTHENTICATED_ALLOWLIST = new Set([
  ...AUTHENTICATED_DIRECT_RPCS,
  ...AUTHENTICATED_CALLER_CONTEXT,
  ...SPEC_PINNED_SELF_SERVICE,
])

// A representative dangerous subset that MUST NOT be authenticated-executable.
const MUST_BE_LOCKED = [
  "create_merchant_onboarding",
  "admin_purge_stale_customer_pii",
  "claim_due_notification_events",
  "enqueue_notification_event",
  "expire_due_reward_events",
  "record_notification_delivery",
  "record_operational_cron_run",
  "production_operational_signals",
  "apply_current_stripe_subscription",
  "bind_billing_checkout_offer",
  "claim_billing_checkout_attempt",
  "finalize_billing_checkout_session",
  "satisfy_merchant_launch_fee",
  "register_customer_session",
  "record_customer_marketing_consent",
  "join_customer_membership_with_first_stamp",
  "issue_self_service_stamp",
]

const INTERNAL_ONLY_FUNCTIONS = new Set([
  "purge_customer_otp_devices_after_erasure",
  "reject_password_access_tokens",
  "require_admin_webauthn_user_verification",
])

after(closeDb)

async function publicFunctions() {
  return db()`
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname`
}

test("no public function is executable by PUBLIC or anon", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const fns = await publicFunctions()
  const leaked = []
  for (const fn of fns) {
    const [{ pub, anon }] = await db()`
      select
        has_function_privilege('public', ${fn.oid}::oid, 'EXECUTE') as pub,
        has_function_privilege('anon', ${fn.oid}::oid, 'EXECUTE') as anon`
    if (pub || anon) leaked.push(`${fn.proname} (public=${pub}, anon=${anon})`)
  }

  assert.deepEqual(
    leaked,
    [],
    `functions still executable by PUBLIC/anon:\n${leaked.join("\n")}`
  )
})

test("authenticated can execute only the allowlist", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const fns = await publicFunctions()
  const unexpectedlyGranted = []
  const unexpectedlyRevoked = []

  for (const fn of fns) {
    const [{ can }] = await db()`
      select has_function_privilege('authenticated', ${fn.oid}::oid, 'EXECUTE') as can`
    const shouldHave = AUTHENTICATED_ALLOWLIST.has(fn.proname)
    if (can && !shouldHave) unexpectedlyGranted.push(fn.proname)
    if (!can && shouldHave) unexpectedlyRevoked.push(fn.proname)
  }

  assert.deepEqual(
    unexpectedlyGranted,
    [],
    `authenticated can execute off-allowlist functions:\n${unexpectedlyGranted.join("\n")}`
  )
  assert.deepEqual(
    unexpectedlyRevoked,
    [],
    `authenticated LOST execute on allowlisted functions (breaks the app):\n${unexpectedlyRevoked.join("\n")}`
  )
})

test("service_role can execute every public function except internal hooks", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const fns = await publicFunctions()
  const missing = []
  for (const fn of fns) {
    const [{ can }] = await db()`
      select has_function_privilege('service_role', ${fn.oid}::oid, 'EXECUTE') as can`
    if (!can && !INTERNAL_ONLY_FUNCTIONS.has(fn.proname)) {
      missing.push(fn.proname)
    }
  }

  assert.deepEqual(
    missing,
    [],
    `service_role is missing execute on:\n${missing.join("\n")}`
  )
})

test("the dangerous subset is locked away from authenticated", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  for (const name of MUST_BE_LOCKED) {
    const rows = await db()`
      select has_function_privilege('authenticated', p.oid, 'EXECUTE') as can
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = ${name}`
    assert.ok(rows.length > 0, `expected function ${name} to exist`)
    for (const row of rows) {
      assert.equal(
        row.can,
        false,
        `${name} must not be authenticated-executable`
      )
    }
  }
})

test("set role authenticated cannot call a locked SECURITY DEFINER RPC", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await assert.rejects(
    db().begin(async (tx) => {
      await tx`set local role authenticated`
      await tx`select public.admin_purge_stale_customer_pii(now())`
    }),
    (error) => {
      assert.match(
        String(error.message),
        /permission denied|not authorized|service/i
      )
      return true
    }
  )
})

test("authenticated cannot invoke customer join or QR stamp wrappers", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await assert.rejects(
    db().begin(async (tx) => {
      await tx`set local role authenticated`
      await tx`
        select *
        from public.join_customer_membership_with_first_stamp(
          null::uuid,
          'locked-test',
          null,
          false,
          'locked-test'
        )`
    }),
    (error) => {
      assert.match(String(error.message), /permission denied/i)
      return true
    }
  )

  await assert.rejects(
    db().begin(async (tx) => {
      await tx`set local role authenticated`
      await tx`
        select *
        from public.issue_self_service_stamp(
          null::uuid,
          null::uuid,
          'locked-test'
        )`
    }),
    (error) => {
      assert.match(String(error.message), /permission denied/i)
      return true
    }
  )
})

test("admin_purge_stale_customer_pii self-guards against non-service callers", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  // Even reached as a privileged Postgres session, the function must refuse to
  // run unless the request's JWT role is service_role.
  await assert.rejects(
    db().begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await tx`select public.admin_purge_stale_customer_pii(now())`
    }),
    (error) => {
      assert.match(String(error.message), /service|not authorized|privilege/i)
      return true
    }
  )
})
