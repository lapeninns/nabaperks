import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// MS-merchant-soft-geofence-knob — pins the knob contract:
//   1. the migration swaps the =3 constant CHECK for the 1–99 range and
//      rebuilds the fraud-flag reason dynamically (no hardcoded stamp 3),
//   2. the historical =3 re-add is replay-guarded on the new range check,
//   3. the submission pipeline validates 1–99 server-side and writes the
//      column, and
//   4. the control lives on the real venue form (Advanced GPS checks).
// Behavior: tests/db/soft-geofence-knob.test.mjs; browser render:
// tests/e2e/merchant-soft-geofence.spec.ts (@soft-geofence).

const migration = readFileSync(
  "supabase/migrations/20260707093000_soft_geofence_trigger_knob.sql",
  "utf8"
)
const historical = readFileSync(
  "supabase/migrations/20260619120000_cycle_stamp_soft_geofence.sql",
  "utf8"
)
const submission = readFileSync("lib/merchant/venue-location-submission.ts", "utf8")
const gpsChecks = readFileSync(
  "components/merchant/launch/advanced-gps-checks.tsx",
  "utf8"
)

test("the migration widens the bound and drops the hardcoded reason", () => {
  assert.match(
    migration,
    /drop constraint if exists merchant_locations_soft_geofence_trigger_stamp_number_check/,
    "the =3 constant CHECK is dropped"
  )
  assert.match(
    migration,
    /check \(soft_geofence_trigger_stamp_number between 1 and 99\)/,
    "the range CHECK is 1–99 (mirrors stamps_required)"
  )
  assert.match(
    migration,
    /'cycle_stamp_' \|\| p_cycle_stamp_number \|\| '_soft_geofence'/,
    "the fraud-flag reason carries the configured stamp number"
  )
  assert.doesNotMatch(
    migration.replace(/^--.*$/gm, ""),
    /cycle_stamp_3_soft_geofence/,
    "no hardcoded stamp-3 reason may remain"
  )
})

test("the historical =3 re-add is replay-guarded", () => {
  assert.match(
    historical,
    /merchant_locations_soft_geofence_trigger_range_check/,
    "the 2026-06-19 migration checks for the new range constraint before re-adding =3"
  )
})

test("the submission pipeline validates and persists the knob", () => {
  assert.match(submission, /softGeofenceTriggerStamp/, "the field is parsed")
  assert.match(
    submission,
    /Use a stamp number from 1 to 99\./,
    "server-side validation enforces the same bound as the DB CHECK"
  )
  assert.match(
    submission,
    /soft_geofence_trigger_stamp_number: options\.softGeofenceTriggerStamp \?\? 3/,
    "the write payload carries the knob with a 3 default for knob-less callers"
  )
})

test("the control lives on the real venue form", () => {
  assert.match(
    gpsChecks,
    /name="softGeofenceTriggerStamp"/,
    "the input posts the field the action parses"
  )
  assert.match(
    gpsChecks,
    /Check on stamp number/,
    "the control is labelled for the merchant"
  )
})
