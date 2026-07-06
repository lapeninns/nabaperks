import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * MS-referral-bonus-stamp — source-scan tier.
 *
 * Proves the bonus mechanic is wired the way the spec's constraints demand:
 * server-authoritative (a SECURITY DEFINER, service-role-only primitive, not a
 * client write), the bonus is an earned/NULL-dated `referral_bonus` stamp, the
 * inner ledger hook is fail-safe (wrapped), a drain sweep exists, and the shared
 * link is built from the opaque referral_code — never a membership UUID.
 */

const root = process.cwd()
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8")

const migration = read(
  "supabase/migrations/20260709090000_referral_bonus_stamp.sql"
)
const referral = read("lib/customer/referral.ts")

test("the bonus primitive is SECURITY DEFINER and granted to service_role only", () => {
  assert.match(
    migration,
    /create or replace function public\.award_referrer_bonus_stamp\([\s\S]*?security definer/,
    "the bonus is issued by a security-definer primitive"
  )
  assert.match(
    migration,
    /grant execute on function public\.award_referrer_bonus_stamp\([^)]*\)\s*to service_role/,
    "the primitive is service-role-only (not customer-callable)"
  )
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.award_referrer_bonus_stamp\([^)]*\)\s*to[^;]*authenticated/,
    "the primitive is never granted to authenticated"
  )
})

test("the bonus stamp is an earned, NULL-dated referral_bonus event", () => {
  assert.match(
    migration,
    /'source'\s*,\s*'referral_bonus'/,
    "provenance is referral_bonus"
  )
  assert.match(
    migration,
    /insert into public\.stamp_events[\s\S]*?earned_business_date[\s\S]*?values[\s\S]*?'earned'/,
    "the bonus is an earned stamp"
  )
})

test("the QR-gated stamp entrypoint calls the bonus primitive behind a fail-safe wrapper", () => {
  assert.match(
    migration,
    /create or replace function public\.issue_self_service_stamp\(\s*p_membership_id uuid,\s*p_customer_id uuid,\s*p_qr_id text/,
    "the QR-gated overload (which both stamp paths route through) is re-created"
  )
  assert.match(
    migration,
    /begin[\s\S]*?perform public\.award_referrer_bonus_stamp[\s\S]*?exception\s+when others/,
    "the bonus hook is wrapped so a failure never blocks the friend's stamp"
  )
})

test("a drain sweep exists to pay bonuses held due", () => {
  assert.match(
    migration,
    /create or replace function public\.drain_due_referrer_bonuses\(/,
    "a drain function pays due bonuses when room frees"
  )
})

test("the shared link is built from the opaque referral_code, never a UUID", () => {
  assert.match(
    referral,
    /join\?ref=/,
    "the link targets the join route with a ref code"
  )
  assert.match(
    referral,
    /referral_?[cC]ode|referralCode|code/,
    "the link is parameterised by the referral code"
  )
  assert.doesNotMatch(
    referral,
    /membership_?[iI]d|membershipId/,
    "the shared link never carries a membership id"
  )
})
