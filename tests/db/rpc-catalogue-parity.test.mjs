import { after, test } from "node:test"
import assert from "node:assert/strict"

import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"

/**
 * R-04 — loyalty-critical RPC signature parity (no catalogue drift).
 *
 * The 122 migrations redefine RPC bodies with `create or replace`, and privilege
 * containment (20260711090000) revoked EXECUTE by default then re-granted a
 * hand-verified allowlist BY SIGNATURE. A migration that adds a new overload, or
 * changes an argument list without dropping the old function, silently leaves a
 * stale definition the planner can bind — or an authenticated call site that now
 * resolves to an ungranted signature and fails closed. The repair migration
 * 20260713090000 exists because exactly this happened to the join/self-service
 * signatures.
 *
 * This pins the EXACT set of identity-argument signatures for each loyalty-
 * critical function. A drift (extra overload, missing overload, changed args)
 * fails here, forcing a conscious update of both the manifest and every affected
 * `.rpc()` call site + grant. Complements rpc-execute-privilege-containment
 * (which pins the grants) by pinning the shapes.
 */

// Identity arguments exactly as `pg_get_function_identity_arguments` renders
// them. Multiple entries mean intended overloads (issue_self_service_stamp keeps
// a QR-less and a QR-gated form). Update deliberately when a migration changes a
// signature — never to make a red test green without checking the call sites.
const EXPECTED_SIGNATURES = {
  issue_self_service_stamp: [
    "p_membership_id uuid, p_customer_id uuid, p_latitude numeric, p_longitude numeric, p_accuracy_meters numeric, p_location_status text, p_capture_elapsed_ms integer",
    "p_membership_id uuid, p_customer_id uuid, p_qr_id text, p_latitude numeric, p_longitude numeric, p_accuracy_meters numeric, p_location_status text, p_capture_elapsed_ms integer, p_referral_bonuses_pre_drained integer",
  ],
  join_customer_membership_with_first_stamp: [
    "p_customer_id uuid, p_merchant_slug text, p_qr_id text, p_marketing_opt_in boolean, p_policy_version text, p_latitude numeric, p_longitude numeric, p_ref text",
  ],
  redeem_self_service_reward: [
    "p_reward_event_id uuid, p_customer_id uuid, p_latitude numeric, p_longitude numeric",
  ],
  create_reward_scan_token: ["p_reward_event_id uuid, p_customer_id uuid"],
  collect_reward_scan_token: ["p_scan_token uuid, p_merchant_id uuid"],
  award_referrer_bonus_stamp: [
    "p_referred_membership_id uuid, p_source_stamp_event_id uuid",
  ],
  qualify_referral_on_stamp: ["p_membership_id uuid, p_stamp_event_id uuid"],
  admit_qr_scan: ["p_identity_bucket text, p_code_bucket text"],
  admit_customer_otp_verify: ["p_phone_bucket text, p_identity_bucket text"],
  admit_customer_otp_dispatch: [
    "p_scope text, p_phone_bucket text, p_identity_bucket text, p_ip_bucket text, p_phone_hmac text, p_device_hash text",
  ],
  admit_anonymous_customer_email_otp_send: [
    "p_device_bucket text, p_ip_bucket text, p_recipient_bucket text, p_cooldown_bucket text, p_global_minute_bucket text, p_global_hour_bucket text",
  ],
  touch_customer_session_and_load: [
    "p_customer_id uuid, p_session_id uuid, p_device_hash text",
  ],
  get_customer_card_state: ["p_membership_id uuid, p_customer_id uuid"],
  get_reward_collection_state: ["p_reward_id uuid"],
  get_reward_collection_states: ["p_reward_ids uuid[]"],
  list_pending_reward_notification_candidates: [
    "p_event_type text, p_now timestamp with time zone, p_limit integer",
  ],
  list_pending_next_stamp_available: [
    "p_now timestamp with time zone, p_limit integer",
  ],
  save_loyalty_card: [
    "p_merchant_id uuid, p_card_id uuid, p_card_name text, p_stamps_required integer, p_reward_name text, p_reward_terms text, p_is_active boolean, p_reward_expires_after_days integer, p_minimum_spend_pence integer, p_one_transaction_per_stamp boolean",
  ],
  upsert_reward_pool_item: [
    "p_merchant_id uuid, p_loyalty_card_id uuid, p_reward_pool_item_id uuid, p_reward_name text, p_reward_terms text, p_weight integer, p_is_active boolean, p_display_order integer, p_requires_age_check boolean",
  ],
  save_loyalty_card_birthday_reward: [
    "p_merchant_id uuid, p_loyalty_card_id uuid, p_enabled boolean, p_reward_name text, p_reward_terms text, p_requires_age_check boolean",
  ],
  issue_merchant_direct_reward: [
    "p_merchant_id uuid, p_membership_id uuid, p_reward_name text, p_reward_terms text, p_expires_in_days integer, p_reason text, p_requires_age_check boolean",
  ],
  create_bounded_merchant_reward_invite: [
    "p_merchant_id uuid, p_email_hmac text, p_phone_hmac text, p_email_masked text, p_phone_last4 text, p_reward_name text, p_reward_terms text, p_personal_message text, p_reward_expires_after_days integer, p_claim_token_hash text, p_unsubscribe_token_hash text, p_requires_age_check boolean",
  ],
  record_notification_delivery: [
    "p_notification_event_id uuid, p_push_subscription_id uuid, p_customer_id uuid, p_status text, p_attempt_number integer, p_response_status integer, p_failure_reason text, p_metadata jsonb, p_channel text, p_recipient_last4 text",
  ],
  admit_notification_message_delivery: [
    "p_notification_event_id uuid, p_customer_id uuid, p_channel text, p_attempt_number integer, p_recipient_last4 text",
  ],
  save_venue_collection_windows: [
    "p_merchant_id uuid, p_location_id uuid, p_windows jsonb",
  ],
  add_venue_closure: [
    "p_merchant_id uuid, p_location_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_reason text",
  ],
  end_venue_closure: ["p_closure_id uuid"],
  list_collection_window_reminders: [
    "p_now timestamp with time zone, p_horizon_hours integer",
  ],
  admin_suspend_merchant: ["p_merchant_id uuid, p_reason text"],
  admin_reinstate_merchant: ["p_merchant_id uuid"],
}

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "loyalty-critical RPCs expose exactly their pinned signatures — no drift",
  { skip },
  async () => {
    const sql = db()
    const names = Object.keys(EXPECTED_SIGNATURES)
    const rows = await sql`
      select p.proname,
             pg_get_function_identity_arguments(p.oid) as identity_args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any(${names})`

    const actual = new Map(names.map((name) => [name, []]))
    for (const row of rows) actual.get(row.proname)?.push(row.identity_args)

    for (const name of names) {
      const got = [...actual.get(name)].sort()
      const want = [...EXPECTED_SIGNATURES[name]].sort()
      assert.deepEqual(
        got,
        want,
        `${name}: live signatures drifted from the pinned manifest.\n  live: ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`
      )
    }
  }
)
