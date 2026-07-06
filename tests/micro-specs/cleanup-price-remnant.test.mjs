import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// MS-cleanup-price-remnant — pins the two stale-remnant fixes from the
// 2026-07-06 legacy/offer audit (docs/product/legacy-offer-v1-cleanup-goal.md):
//   1. the provider-readiness Stripe check must validate the live £49 Growth
//      price (4900 pence), not the stale £29 it went out of date on when £49
//      shipped; and
//   2. the fully-absorbed offer-v1 Micro-Spec must be marked `superseded` by
//      offer-v2 — NOT deleted (its test, evidence ledger, and the facts.ts
//      provenance it documents stay live; see the goal-doc KEEP list).

const providerChecks = readFileSync(
  "scripts/provider-readiness/checks.mjs",
  "utf8"
)
const offerV1Spec = readFileSync("micro-specs/marketing/offer-v1.md", "utf8")

test("provider-readiness Stripe check validates the live £49 Growth price", () => {
  assert.match(
    providerChecks,
    /unit_amount === 4900/,
    "checkStripe must assert the £49 unit_amount (4900 pence)"
  )
  assert.match(
    providerChecks,
    /GBP 49\/month/,
    'the stripe-price report text must read "GBP 49/month"'
  )
})

test("provider-readiness Stripe check drops the stale £29 remnant", () => {
  assert.doesNotMatch(
    providerChecks,
    /unit_amount === 2900/,
    "the stale 2900 literal must be gone"
  )
  assert.doesNotMatch(
    providerChecks,
    /29\/month/,
    'no "29/month" report text may remain'
  )
})

test("offer-v1 Micro-Spec is superseded by offer-v2, not deleted", () => {
  assert.match(
    offerV1Spec,
    /^status: superseded$/m,
    "MS-marketing-offer-v1 must be status: superseded"
  )
  assert.match(
    offerV1Spec,
    /^superseded_by: MS-marketing-offer-v2$/m,
    "offer-v1 must name MS-marketing-offer-v2 as its successor"
  )
})
