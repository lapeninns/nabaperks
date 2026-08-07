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
