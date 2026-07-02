import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildMerchantWeeklyDigestEmail } from "@/lib/notifications/merchant-digest-email"

const fixtureMetrics = {
  members: 1234,
  newMembers: 18,
  stampsIssued: 9876,
  repeatCustomers: 42,
  rewardsRedeemed: 31,
  qrDownloads: 7,
}

const fixtureTrends = {
  newMembers: {
    current: 18,
    previous: 12,
    delta: 6,
    direction: "up",
    label: "+6 vs last week",
  },
  stamps: {
    current: 98,
    previous: 98,
    delta: 0,
    direction: "flat",
    label: "Same as last week",
  },
  rewards: {
    current: 31,
    previous: 36,
    delta: -5,
    direction: "down",
    label: "−5 vs last week",
  },
  qrDownloads: {
    current: 7,
    previous: 3,
    delta: 4,
    direction: "up",
    label: "+4 vs last week",
  },
}

describe("merchant weekly digest email", () => {
  it("renders dashboard metrics and trend labels in the digest", () => {
    // Given
    const digest = buildMerchantWeeklyDigestEmail({
      businessName: "The Crown",
      metrics: fixtureMetrics,
      trends: fixtureTrends,
    })

    // When
    const body = `${digest.text}\n${digest.html}`

    // Then
    assert.equal(digest.subject, "Your week at The Crown")
    assert.match(body, /Members/)
    assert.match(body, /1,234/)
    assert.match(body, /New members/)
    assert.match(body, /18/)
    assert.match(body, /\+6 vs last week/)
    assert.match(body, /Stamps issued/)
    assert.match(body, /9,876/)
    assert.match(body, /Same as last week/)
    assert.match(body, /Rewards redeemed/)
    assert.match(body, /31/)
    assert.match(body, /−5 vs last week/)
    assert.match(body, /QR downloads/)
    assert.match(body, /7/)
    assert.match(body, /\+4 vs last week/)
  })

  it("escapes the business name in HTML while keeping the subject readable", () => {
    // Given
    const businessName = "A&B <The Crown>"

    // When
    const digest = buildMerchantWeeklyDigestEmail({
      businessName,
      metrics: fixtureMetrics,
      trends: fixtureTrends,
    })

    // Then
    assert.equal(digest.subject, `Your week at ${businessName}`)
    assert.match(digest.html, /A&amp;B &lt;The Crown&gt;/)
    assert.doesNotMatch(digest.html, /A&B <The Crown>/)
    assert.match(digest.text, /A&B <The Crown>/)
  })

  it("renders honest opt-out copy without exclamation marks", () => {
    // Given
    const digest = buildMerchantWeeklyDigestEmail({
      businessName: "The Crown",
      metrics: fixtureMetrics,
      trends: fixtureTrends,
    })

    // When
    const completeCopy = `${digest.subject}\n${digest.text}\n${digest.html}`

    // Then
    assert.match(
      completeCopy,
      /Reply to this email if you'd rather not receive weekly summaries\./
    )
    assert.doesNotMatch(completeCopy, /!/)
  })
})
