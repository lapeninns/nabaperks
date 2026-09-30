import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildRewardCountsByMembership,
  getTopRedeemable,
} from "@/lib/customer/home-rewards"

const ADULT = { statedDateOfBirthIsAdult: true }

function row(overrides = {}) {
  return {
    id: "r",
    membership_id: "mem_1",
    reward_name: "Reward",
    collection_state: "ready",
    available_from: "2026-07-02T05:00:00Z",
    source: "stamp_cycle",
    created_at: "2026-07-01T09:00:00.000Z",
    ...overrides,
  }
}

test("stamp-cycle and issued rewards land on separate rails", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "stamp_ready",
        source: "stamp_cycle",
        reward_name: "Free coffee",
      }),
      row({
        id: "bday_ready",
        source: "birthday_month",
        reward_name: "Birthday fizz",
      }),
    ],
    ADULT
  )
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, "stamp_ready")
  assert.equal(mem.stampRewardName, "Free coffee")
  // Only the stamp-cycle row counts toward the card's own pending rewards.
  assert.equal(mem.stampUnlocked, 1)
  // The issued reward is split onto the gift rail.
  assert.equal(mem.gift?.rewardId, "bday_ready")
  assert.equal(mem.gift?.source, "birthday_month")
  assert.equal(mem.gift?.redeemable, true)
})

test("an issued reward alone leaves the stamp card with no ready or soon reward", () => {
  const counts = buildRewardCountsByMembership(
    [row({ id: "direct_ready", source: "merchant_direct" })],
    ADULT
  )
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, null)
  assert.equal(mem.revealedRewardName, null)
  assert.equal(mem.stampUnlocked, 0)
  assert.equal(mem.gift?.rewardId, "direct_ready")
  assert.equal(mem.gift?.source, "merchant_direct")
})

test("a waiting stamp-cycle reward drives the revealed ticket, not the ready state", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "stamp_wait",
        source: "stamp_cycle",
        collection_state: "waiting",
        available_from: "2026-07-03T05:00:00Z",
        reward_name: "Free pastry",
      }),
    ],
    ADULT
  )
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, null)
  assert.equal(mem.revealedRewardName, "Free pastry")
  assert.equal(mem.revealedRewardAvailableFrom, "2026-07-03T05:00:00Z")
  assert.equal(mem.stampUnlocked, 1)
  assert.equal(mem.gift, null)
})

test("getTopRedeemable surfaces a redeemable gift when there is no earned reward", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "gift_ready",
        source: "birthday_month",
        reward_name: "Birthday fizz",
      }),
    ],
    ADULT
  )
  const cards = [{ membershipId: "mem_1", businessName: "Old Crown" }]

  const top = getTopRedeemable(cards, counts)

  // The collect-now banner stays cross-source so a gift still nudges.
  assert.equal(top?.rewardId, "gift_ready")
  assert.equal(top?.rewardName, "Birthday fizz")
  assert.equal(top?.businessName, "Old Crown")
})

test("getTopRedeemable prefers the earned stamp reward over a gift on the same card", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "stamp_ready",
        source: "stamp_cycle",
        reward_name: "Free coffee",
      }),
      row({
        id: "gift_ready",
        source: "birthday_month",
        reward_name: "Birthday fizz",
      }),
    ],
    ADULT
  )
  const cards = [{ membershipId: "mem_1", businessName: "Old Crown" }]

  assert.equal(getTopRedeemable(cards, counts)?.rewardId, "stamp_ready")
})

test("getTopRedeemable ignores a gift that is not yet redeemable", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "gift_wait",
        source: "birthday_month",
        collection_state: "waiting",
      }),
    ],
    ADULT
  )
  const cards = [{ membershipId: "mem_1", businessName: "Old Crown" }]

  assert.equal(getTopRedeemable(cards, counts), undefined)
})

test("database readiness supports legacy full cards and post-cutover fresh cards", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({ id: "legacy_reward", membership_id: "legacy_3_of_3" }),
      row({ id: "cutover_reward", membership_id: "fresh_0_of_2" }),
    ],
    ADULT
  )
  const cards = [
    {
      membershipId: "legacy_3_of_3",
      businessName: "Legacy Arms",
      currentStamps: 3,
      stampsRequired: 3,
    },
    {
      membershipId: "fresh_0_of_2",
      businessName: "Cutover Arms",
      currentStamps: 0,
      stampsRequired: 2,
    },
  ]

  assert.equal(counts.get("legacy_3_of_3")?.stampRewardId, "legacy_reward")
  assert.equal(counts.get("fresh_0_of_2")?.stampRewardId, "cutover_reward")
  assert.equal(getTopRedeemable(cards, counts)?.rewardId, "legacy_reward")
})

test("a stamp reward held only by a setup step stays the ready action on Home", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "needs_email",
        collection_state: "blocked",
        collection_reason: "Verified email required for reward collection",
      }),
    ],
    ADULT
  )
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, "needs_email")
  assert.equal(mem.revealedRewardName, null)
})

test("a stamp reward blocked by the venue is neither ready nor soon on Home", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "paused",
        collection_state: "blocked",
        collection_reason: "This loyalty programme is unavailable right now",
      }),
    ],
    ADULT
  )
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, null)
  assert.equal(mem.revealedRewardName, null)
  assert.equal(mem.stampUnlocked, 1)
})

test("a stamp reward held only by setup keeps its link but is flagged as needing setup", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "stamp_setup",
        collection_state: "blocked",
        collection_reason: "Complete your profile before redeeming",
        reward_name: "Free coffee",
      }),
    ],
    ADULT
  )
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, "stamp_setup")
  assert.equal(mem.stampRewardNeedsSetup, true)

  const top = getTopRedeemable(
    [{ membershipId: "mem_1", businessName: "Old Crown" }],
    counts
  )
  assert.equal(top?.rewardId, "stamp_setup")
  assert.equal(top?.needsSetup, true)
})

test("a photo-ID counter check is ready to collect, not a setup step", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "stamp_id",
        collection_state: "blocked",
        collection_reason:
          "Customer must have verified photo ID and be 18 or over to redeem",
      }),
    ],
    { statedDateOfBirthIsAdult: true }
  )

  assert.equal(counts.get("mem_1").stampRewardId, "stamp_id")
  assert.equal(counts.get("mem_1").stampRewardNeedsSetup, false)
})

test("an under-age customer's age-checked reward is never ready on home", () => {
  const photoId =
    "Customer must have verified photo ID and be 18 or over to redeem"
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "stamp_id",
        collection_state: "blocked",
        collection_reason: photoId,
      }),
      row({
        id: "gift_id",
        source: "birthday_month",
        collection_state: "blocked",
        collection_reason: photoId,
      }),
    ],
    { statedDateOfBirthIsAdult: false }
  )
  const entry = counts.get("mem_1")

  assert.equal(entry.stampRewardId, null)
  assert.equal(entry.gift?.rewardId, "gift_id")
  assert.equal(entry.gift?.redeemable, false)
  assert.equal(entry.gift?.needsSetup, false)
  assert.equal(
    getTopRedeemable(
      [{ membershipId: "mem_1", businessName: "Old Crown" }],
      counts
    ),
    undefined
  )
})

test("the home banner leads with a reward ready now over one that needs setup", () => {
  const counts = buildRewardCountsByMembership(
    [
      row({
        id: "setup_first_card",
        membership_id: "mem_1",
        collection_state: "blocked",
        collection_reason: "Verified email required for reward collection",
      }),
      row({ id: "ready_second_card", membership_id: "mem_2" }),
    ],
    ADULT
  )
  const cards = [
    { membershipId: "mem_1", businessName: "Old Crown" },
    { membershipId: "mem_2", businessName: "The Anchor" },
  ]

  const top = getTopRedeemable(cards, counts)
  assert.equal(top?.rewardId, "ready_second_card")
  assert.equal(top?.needsSetup, false)
})
