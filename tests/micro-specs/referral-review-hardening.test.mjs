import { readFile } from "node:fs/promises"
import { test } from "node:test"
import assert from "node:assert/strict"

const migrationUrl = new URL(
  "../../supabase/migrations/20260712100000_referral_review_hardening.sql",
  import.meta.url
)
const migration = await readFile(migrationUrl, "utf8")
const cardLoader = await readFile(
  new URL("../../lib/customer/experience/load-card.ts", import.meta.url),
  "utf8"
)
const homeLoader = await readFile(
  new URL("../../lib/customer/home.ts", import.meta.url),
  "utf8"
)

test("settlement re-checks terminal status after qualification", () => {
  assert.match(
    migration,
    /perform public\.qualify_referral_on_stamp[\s\S]*select r\.\* into v_edge[\s\S]*v_edge\.status in \('awarded', 'rejected', 'cancelled', 'expired'\)[\s\S]*return 'skipped_terminal'/
  )
})

test("qualification and settlement relink membership churn by customer + venue", () => {
  assert.match(
    migration,
    /create or replace function public\.relink_referral_memberships/
  )
  assert.match(
    migration,
    /r\.referred_customer_id = v_membership\.customer_id[\s\S]*r\.venue_id = v_membership\.merchant_id/
  )
  assert.match(
    migration,
    /current_referrer\.customer_id = r\.referrer_customer_id[\s\S]*current_referrer\.merchant_id = r\.venue_id/
  )
})

test("the member drain respects next_retry_at", () => {
  assert.match(
    migration,
    /drain_due_referrer_bonuses_for_membership[\s\S]*next_retry_at is null or referrals\.next_retry_at <= now\(\)/
  )
})

test("paused referral links are absent from card and home loaders", () => {
  assert.match(cardLoader, /membership\.referral_code_active &&/)
  assert.match(homeLoader, /membership\.referral_code_active &&/)
})

test("SQL referral notifications carry push copy and routing fields", () => {
  assert.match(migration, /complete_referral_notification_payload/)
  for (const field of ["title", "body", "url", "tag", "eventType", "data"]) {
    assert.match(migration, new RegExp(`'${field}'`))
  }
})

test("admin-disabled referral codes cannot be owner-reactivated", () => {
  assert.match(migration, /referral_code_admin_disabled_at timestamptz/)
  assert.match(
    migration,
    /v_requested_active[\s\S]*referral_code_admin_disabled_at is not null[\s\S]*Referral code disabled by an administrator/
  )
  assert.match(
    migration,
    /referral_code_active[\s\S]*referral_code_admin_disabled_at is null/
  )
})

test("a completing pre-stamp bonus returns before the visit-stamp primitive", () => {
  assert.match(
    migration,
    /v_drained > 0[\s\S]*new_stamp_count >= v_membership\.stamps_required[\s\S]*return next;[\s\S]*return;[\s\S]*from public\.issue_self_service_stamp/
  )
})

test("admin review refuses awarded referrals", () => {
  assert.match(
    migration,
    /v_edge\.status = 'awarded' or v_edge\.referrer_bonus_awarded_at is not null[\s\S]*Awarded referrals cannot be reviewed/
  )
})
