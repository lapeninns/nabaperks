import assert from "node:assert/strict"
import { test } from "node:test"

import { OFFER_PASS_SCAN_TOKEN_TTL_MS } from "@/lib/offers/constants"
import {
  offerPassQrCacheBustedSrc,
  offerPassQrRefreshIntervalMs,
  offerPassScanUrl,
} from "@/lib/offers/pass-qr"
import {
  OFFER_PASS_SCAN_STATUSES,
  offerPassDiscountLabel,
  offerPassScanBanner,
  offerPassValidityLabel,
  validateOfferPassAttestations,
} from "@/lib/offers/redeem-core"

/**
 * Pure rules behind staff redemption of a discount pass. The attestation matrix
 * is the important one: no-stacking is ALWAYS required, and the ID check is
 * required if and only if the campaign asked for it.
 */

const MATRIX = [
  // requiresIdCheck, idChecked, noStacking, expected ok
  [false, false, true, true],
  [false, true, true, true],
  [true, true, true, true],
  [true, false, true, false],
  [false, false, false, false],
  [false, true, false, false],
  [true, true, false, false],
  [true, false, false, false],
]

test("attestations pass exactly when no-stacking is given and ID is given if required", () => {
  for (const [requiresIdCheck, idChecked, noStacking, expected] of MATRIX) {
    const result = validateOfferPassAttestations({
      requiresIdCheck,
      idChecked,
      noStacking,
    })

    assert.equal(
      result.ok,
      expected,
      `requiresIdCheck=${requiresIdCheck} idChecked=${idChecked} noStacking=${noStacking}`
    )
  }
})

test("a passing result always reports no-stacking and preserves the ID answer", () => {
  const withoutId = validateOfferPassAttestations({
    requiresIdCheck: false,
    idChecked: false,
    noStacking: true,
  })
  assert.deepEqual(withoutId, { ok: true, idChecked: false, noStacking: true })

  // An ID check volunteered where none was required is still recorded honestly.
  const withId = validateOfferPassAttestations({
    requiresIdCheck: false,
    idChecked: true,
    noStacking: true,
  })
  assert.deepEqual(withId, { ok: true, idChecked: true, noStacking: true })
})

test("each missing attestation reports against its own field", () => {
  const bothMissing = validateOfferPassAttestations({
    requiresIdCheck: true,
    idChecked: false,
    noStacking: false,
  })
  assert.equal(bothMissing.ok, false)
  assert.ok(bothMissing.errors.idCheck)
  assert.ok(bothMissing.errors.noStacking)

  const stackingOnly = validateOfferPassAttestations({
    requiresIdCheck: false,
    idChecked: false,
    noStacking: false,
  })
  assert.equal(stackingOnly.ok, false)
  assert.equal(stackingOnly.errors.idCheck, undefined)
  assert.ok(stackingOnly.errors.noStacking)
})

test("every scan status has a banner and only ready invites a confirmation", () => {
  for (const status of OFFER_PASS_SCAN_STATUSES) {
    const banner = offerPassScanBanner(status)
    assert.ok(banner.title, `${status} has a title`)
    assert.ok(banner.body, `${status} has a body`)
    assert.ok(["success", "warning"].includes(banner.tone))
  }

  assert.equal(offerPassScanBanner("ready").tone, "success")
  assert.equal(offerPassScanBanner("expired").tone, "warning")
})

test("a used code says the pass itself still works", () => {
  const banner = offerPassScanBanner("redeemed")
  assert.match(banner.body, /pass itself still works/)
})

test("a blocked status uses the database reason when there is one", () => {
  assert.equal(
    offerPassScanBanner("blocked", "This pass is no longer active.").body,
    "This pass is no longer active."
  )
  assert.ok(offerPassScanBanner("blocked").body.length > 0)
})

test("discount and validity labels are British and refuse rubbish dates", () => {
  assert.equal(offerPassDiscountLabel(10), "10% off")
  assert.equal(
    offerPassValidityLabel("2026-08-12"),
    "Valid until 12 August 2026"
  )
  assert.equal(offerPassValidityLabel(null), null)
  assert.equal(offerPassValidityLabel("not-a-date"), null)
})

test("the pass QR refreshes well inside the scan token TTL", () => {
  assert.equal(OFFER_PASS_SCAN_TOKEN_TTL_MS, 10 * 60 * 1000)
  assert.equal(offerPassQrRefreshIntervalMs(), OFFER_PASS_SCAN_TOKEN_TTL_MS / 2)
  assert.ok(offerPassQrRefreshIntervalMs() < OFFER_PASS_SCAN_TOKEN_TTL_MS)
})

test("the pass QR src is cache busted and the encoded URL is the /p handoff", () => {
  assert.equal(
    offerPassQrCacheBustedSrc("11111111-2222-3333-4444-555555555555", 2),
    "/pass/11111111-2222-3333-4444-555555555555/qr.png?t=2"
  )
  assert.equal(
    offerPassScanUrl(
      "https://app.nabaperks.test/",
      "11111111-2222-3333-4444-555555555555"
    ),
    "https://app.nabaperks.test/p/11111111-2222-3333-4444-555555555555"
  )
})
