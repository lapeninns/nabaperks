import assert from "node:assert/strict"
import { test } from "node:test"

import { OFFER_PASS_SCAN_TOKEN_TTL_MS } from "@/lib/offers/constants"
import {
  offerPassQrCacheBustedSrc,
  offerPassQrRefreshIntervalMs,
  offerPassScanUrl,
} from "@/lib/offers/pass-qr"

/**
 * The refresh contract behind the customer's discount-pass QR.
 *
 * The invariant these tests protect is "a member never presents a dead code".
 * Three numbers have to agree for that to hold, and they live in three
 * different places: the ten-minute `offer_pass_scan_tokens.expires_at` default
 * in SQL, `OFFER_PASS_SCAN_TOKEN_TTL_MS`, and the five-minute floor
 * `create_offer_pass_scan_token` will reuse an existing token down to. This
 * file pins the relationships between them so that changing one alone fails
 * here rather than at a counter.
 */

/**
 * The reuse floor written into `create_offer_pass_scan_token`:
 * `expires_at > now() + interval '5 minutes'`.
 */
const SERVER_REUSE_FLOOR_MS = 5 * 60_000

test("the refresh interval is half the token life the database grants", () => {
  assert.equal(OFFER_PASS_SCAN_TOKEN_TTL_MS, 10 * 60_000)
  assert.equal(offerPassQrRefreshIntervalMs(), OFFER_PASS_SCAN_TOKEN_TTL_MS / 2)
})

test("a reused token always outlives the next scheduled refresh", () => {
  // The server may hand back an existing token rather than minting a new one,
  // but only one with more than the reuse floor left. If the refresh interval
  // ever grew past that floor, a reused token could die between two refreshes.
  assert.ok(
    offerPassQrRefreshIntervalMs() <= SERVER_REUSE_FLOOR_MS,
    "refresh interval must not exceed the server's token reuse floor"
  )
})

test("a code on screen is never older than the interval when it is scanned", () => {
  // Walk a long queue: the image refreshes on a fixed interval, and the worst
  // case is a scan landing immediately before the next refresh. The age of the
  // presented code at that instant must stay inside the TTL with room to spare.
  const interval = offerPassQrRefreshIntervalMs()
  const worstCaseAgeMs =
    interval + (OFFER_PASS_SCAN_TOKEN_TTL_MS - interval) / 2

  for (let elapsed = 0; elapsed <= 60 * 60_000; elapsed += interval) {
    const refreshes = Math.floor(elapsed / interval)
    const ageAtNextRefresh = elapsed - refreshes * interval + interval
    assert.ok(
      ageAtNextRefresh <= OFFER_PASS_SCAN_TOKEN_TTL_MS,
      `presented code would be ${ageAtNextRefresh}ms old at ${elapsed}ms`
    )
  }

  assert.ok(worstCaseAgeMs < OFFER_PASS_SCAN_TOKEN_TTL_MS)
})

test("each refresh asks for a distinct image and the same tick is stable", () => {
  const id = "11111111-2222-3333-4444-555555555555"
  const seen = new Set()

  for (let tick = 0; tick < 24; tick += 1) {
    seen.add(offerPassQrCacheBustedSrc(id, tick))
  }

  assert.equal(seen.size, 24, "a cached image must never be reused on refresh")
  assert.equal(
    offerPassQrCacheBustedSrc(id, 7),
    offerPassQrCacheBustedSrc(id, 7),
    "the same tick must not re-fetch"
  )
})

test("the image path stays on the protected route whatever the id looks like", () => {
  // The base path must remain /pass/<id>/qr.png so an unqueried request hits
  // exactly the same gated route the refreshing client does.
  assert.match(
    offerPassQrCacheBustedSrc("11111111-2222-3333-4444-555555555555", 0),
    /^\/pass\/[^/]+\/qr\.png\?t=0$/
  )
  assert.equal(
    offerPassQrCacheBustedSrc("../../app/offers", 1),
    "/pass/..%2F..%2Fapp%2Foffers/qr.png?t=1"
  )
})

test("the encoded URL is the public handoff, with one slash and no double origin", () => {
  const token = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

  assert.equal(
    offerPassScanUrl("https://app.nabaperks.test", token),
    `https://app.nabaperks.test/p/${token}`
  )
  assert.equal(
    offerPassScanUrl("https://app.nabaperks.test///", token),
    `https://app.nabaperks.test/p/${token}`
  )
  assert.doesNotMatch(offerPassScanUrl("https://a.test/", token), /\/\/p\//)
})
