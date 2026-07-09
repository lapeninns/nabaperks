import assert from "node:assert/strict"
import { test } from "node:test"

import { SETUP } from "@/lib/marketing/facts"
import { getActivePromo } from "@/lib/marketing/promo"
import {
  SHOW_NABAPERKS_PROOF,
  nabaperksProofReady,
} from "@/components/marketing/landing/nabaperks-proof-data"

test("@MS-marketing-trust-continuity promo exposes no invented availability", () => {
  const promo = getActivePromo(new Date("2026-07-15T12:00:00Z"))

  assert.ok(promo)
  for (const field of [
    "scarcityLine",
    "scarcityChip",
    "spotsRemaining",
    "monthlyCap",
    "claimedThisMonth",
  ]) {
    assert.equal(
      Object.hasOwn(promo, field),
      false,
      `${field} must not be part of the public promo contract`
    )
  }
  assert.doesNotMatch(
    Object.values(promo).join(" "),
    /spots? left|onboard \d+|\d+ new venues/i
  )
})

test("@MS-marketing-trust-continuity setup makes billing the activation gate", () => {
  const setupCopy = Object.values(SETUP).join(" ")

  assert.match(SETUP.steps, /Five guided steps/i)
  assert.match(setupCopy, /billing/i)
  assert.match(SETUP.earlyWin, /once billing is active/i)
  assert.match(SETUP.earlyWin, /venue QR/i)
  assert.doesNotMatch(setupCopy, /same afternoon|about five minutes/i)
})

test("@MS-marketing-trust-continuity unverified aggregate proof remains unpublished", () => {
  assert.equal(SHOW_NABAPERKS_PROOF, false)
  assert.equal(nabaperksProofReady(), false)
})
