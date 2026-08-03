import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  groupOfferPassesByMembership,
  offerClaimNoticeFromParams,
} from "@/lib/customer/offer-pass-view"

/**
 * The two pure decisions behind the customer's discount-pass rail: which card a
 * pass sits beside, and what the join flow just decided about an offer.
 */

function pass(entitlementId, membershipId) {
  return { entitlementId, membershipId }
}

describe("groupOfferPassesByMembership", () => {
  it("returns an empty map for no passes", () => {
    assert.equal(groupOfferPassesByMembership([]).size, 0)
  })

  it("keeps each pass with its own card", () => {
    const grouped = groupOfferPassesByMembership([
      pass("e1", "m1"),
      pass("e2", "m2"),
      pass("e3", "m1"),
    ])

    assert.equal(grouped.size, 2)
    assert.deepEqual(
      grouped.get("m1")?.map((entry) => entry.entitlementId),
      ["e1", "e3"]
    )
    assert.deepEqual(
      grouped.get("m2")?.map((entry) => entry.entitlementId),
      ["e2"]
    )
  })

  it("preserves the loader's soonest-to-close order inside a card", () => {
    const grouped = groupOfferPassesByMembership([
      pass("closes-first", "m1"),
      pass("closes-later", "m1"),
    ])

    assert.deepEqual(
      grouped.get("m1")?.map((entry) => entry.entitlementId),
      ["closes-first", "closes-later"]
    )
  })

  it("has no bucket for a card the customer holds no pass for", () => {
    const grouped = groupOfferPassesByMembership([pass("e1", "m1")])

    assert.equal(grouped.get("m2"), undefined)
  })
})

describe("offerClaimNoticeFromParams", () => {
  it("reads the three outcomes the join action redirects with", () => {
    // Mirrors app/m/[merchantSlug]/join/actions.ts: ?welcome=1&offer=1,
    // ?offer=claimed and ?membership=existing.
    assert.equal(offerClaimNoticeFromParams({ offer: "1" }), "claimed")
    assert.equal(
      offerClaimNoticeFromParams({ offer: "claimed" }),
      "already_claimed"
    )
    assert.equal(
      offerClaimNoticeFromParams({ membership: "existing" }),
      "already_member"
    )
  })

  it("says nothing when no claim parameter is present", () => {
    assert.equal(offerClaimNoticeFromParams({}), null)
  })

  it("ignores values it does not recognise", () => {
    assert.equal(offerClaimNoticeFromParams({ offer: "yes" }), null)
    assert.equal(offerClaimNoticeFromParams({ offer: "" }), null)
    assert.equal(offerClaimNoticeFromParams({ membership: "new" }), null)
  })

  it("prefers the offer outcome over the membership one", () => {
    // Both can only arrive together on a hand-edited URL; the offer outcome is
    // the more specific statement, so it wins rather than the two competing.
    assert.equal(
      offerClaimNoticeFromParams({ offer: "1", membership: "existing" }),
      "claimed"
    )
  })
})
