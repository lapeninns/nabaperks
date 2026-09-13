import assert from "node:assert/strict"
import { test } from "node:test"

import {
  HOME_STAMP_SCAN_NOTE,
  buildHomeSummary,
  homeCardNextStep,
  homeCardStatusCopy,
  homeSummaryLabels,
  sortHomeCards,
} from "@/lib/customer/home-dashboard"

function card(overrides = {}) {
  return {
    membershipId: "mem_1",
    businessName: "Old Crown Girton",
    businessSlug: "old-crown-girton",
    cardName: "Visit card",
    rewardName: "Free coffee",
    currentStamps: 2,
    stampsRequired: 3,
    stampDates: [],
    stampedToday: false,
    lastVisitAt: null,
    stampsRemaining: 1,
    unlockedRewards: 0,
    available: true,
    ...overrides,
  }
}

test("a card that can still take a stamp is labelled as availability, never as a stamp already collected", () => {
  const summary = buildHomeSummary([card()])
  const labels = homeSummaryLabels(summary)

  // The computed value is "cards that are available, not stamped today and
  // still have stamps remaining" — availability, not activity.
  assert.equal(summary.stampAvailableCount, 1)
  assert.equal(summary.redeemableCount, 0)
  assert.deepEqual(labels, ["1 card", "1 card ready for a stamp"])
  for (const label of labels) {
    assert.doesNotMatch(
      label,
      /stamps? today/i,
      `"${label}" reads as a stamp already earned today`
    )
    assert.doesNotMatch(label, /collected|earned/i)
  }
})

test("collecting today's stamp removes the card from the available count and changes what it says", () => {
  const available = card()
  const stamped = card({
    stampedToday: true,
    currentStamps: 3,
    stampsRemaining: 0,
  })

  assert.equal(buildHomeSummary([stamped]).stampAvailableCount, 0)
  // Nothing left to act on, so the strip stops offering it at all.
  assert.deepEqual(homeSummaryLabels(buildHomeSummary([stamped])), ["1 card"])
  assert.notEqual(homeCardStatusCopy(available), homeCardStatusCopy(stamped))
  assert.match(homeCardStatusCopy(stamped), /collected today/)
  assert.equal(homeCardNextStep(available)?.label, "Ready for a stamp")
  assert.equal(homeCardNextStep(stamped)?.label, "Stamped today")
})

test("the availability copy stays conditional on a venue scan and promises no eligibility", () => {
  const copy = homeCardStatusCopy(card())

  assert.match(copy, /2 of 3 stamps — 1 more to unlock/)
  // The scan condition is stated once, beside the count it qualifies, rather
  // than repeated under every tile.
  assert.ok(!copy.includes(HOME_STAMP_SCAN_NOTE))
  assert.match(HOME_STAMP_SCAN_NOTE, /Scan the QR at the venue/)
  // Nothing may claim the customer is at the venue or already holds the stamp.
  assert.doesNotMatch(
    HOME_STAMP_SCAN_NOTE,
    /you are at|checked in|stamp added/i
  )
  assert.doesNotMatch(copy, /you are at|checked in|stamp added|tomorrow/i)
})

test("the reward count is a count of cards, so a card holding two ready rewards is counted once", () => {
  const both = card({
    stampRewardId: "reward_1",
    gift: {
      rewardId: "gift_1",
      rewardName: "Birthday treat",
      source: "birthday_month",
      redeemable: true,
      redeemableFrom: null,
    },
  })
  const summary = buildHomeSummary([both])

  assert.equal(summary.redeemableCount, 1)
  assert.equal(homeSummaryLabels(summary)[1], "1 card with a reward ready")
})

test("summary labels stay singular, plural and zero-correct", () => {
  assert.deepEqual(
    homeSummaryLabels({
      cardCount: 1,
      redeemableCount: 1,
      stampAvailableCount: 1,
    }),
    ["1 card", "1 card with a reward ready", "1 card ready for a stamp"]
  )
  assert.deepEqual(
    homeSummaryLabels({
      cardCount: 3,
      redeemableCount: 0,
      stampAvailableCount: 2,
    }),
    ["3 cards", "2 cards ready for a stamp"]
  )
  assert.deepEqual(
    homeSummaryLabels({
      cardCount: 0,
      redeemableCount: 0,
      stampAvailableCount: 0,
    }),
    ["0 cards"]
  )
})

test("the five per-card states read differently from one another", () => {
  const states = {
    stampAvailable: homeCardStatusCopy(card()),
    stampedToday: homeCardStatusCopy(card({ stampedToday: true })),
    rewardWaiting: homeCardStatusCopy(card({ unlockedRewards: 1 })),
    rewardReady: homeCardStatusCopy(card({ stampRewardId: "reward_1" })),
    unavailable: homeCardStatusCopy(
      card({
        available: false,
        unavailableReason: "This venue has paused stamps.",
      })
    ),
  }

  assert.equal(new Set(Object.values(states)).size, 5)
  // The chip beside each tile keeps the same five apart at a glance.
  assert.deepEqual(
    [
      homeCardNextStep(card())?.label,
      homeCardNextStep(card({ stampedToday: true }))?.label,
      homeCardNextStep(card({ unlockedRewards: 1 }))?.label,
      homeCardNextStep(card({ stampRewardId: "reward_1" }))?.label,
      homeCardNextStep(card({ available: false }))?.label,
    ],
    [
      "Ready for a stamp",
      "Stamped today",
      "Reward soon",
      "Reward ready",
      undefined,
    ]
  )
  assert.match(states.rewardReady, /Reward ready to collect/)
  // `redeemable_from` can skip closed days, so the waiting reward never promises
  // "tomorrow" — it points at the venue's next opening day.
  assert.match(states.rewardWaiting, /next opening day/)
  assert.doesNotMatch(states.rewardWaiting, /tomorrow/i)
  // The server's own reason is passed through untouched.
  assert.equal(states.unavailable, "This venue has paused stamps.")
})

test("a ready reward still sorts above a card that is only ready for a stamp", () => {
  const ready = card({ membershipId: "mem_ready", stampRewardId: "reward_1" })
  const available = card({ membershipId: "mem_available" })

  assert.deepEqual(
    sortHomeCards([available, ready]).map((entry) => entry.membershipId),
    ["mem_ready", "mem_available"]
  )
})
