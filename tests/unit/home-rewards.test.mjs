import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildRewardCountsByMembership,
  getTopRedeemable,
} from "@/lib/customer/home-rewards"

// Fixed past/future dates keep redeemability deterministic regardless of clock.
const PAST = "2020-01-01"
const FUTURE = "2099-01-01"

function row(overrides = {}) {
  return {
    id: "r",
    membership_id: "mem_1",
    reward_name: "Reward",
    redeemable_from: PAST,
    source: "stamp_cycle",
    created_at: "2026-07-01T09:00:00.000Z",
    ...overrides,
  }
}

test("stamp-cycle and issued rewards land on separate rails", () => {
  const counts = buildRewardCountsByMembership([
    row({ id: "stamp_ready", source: "stamp_cycle", reward_name: "Free coffee" }),
    row({
      id: "bday_ready",
      source: "birthday_month",
      reward_name: "Birthday fizz",
    }),
  ])
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
  const counts = buildRewardCountsByMembership([
    row({ id: "direct_ready", source: "merchant_direct" }),
  ])
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, null)
  assert.equal(mem.revealedRewardName, null)
  assert.equal(mem.stampUnlocked, 0)
  assert.equal(mem.gift?.rewardId, "direct_ready")
  assert.equal(mem.gift?.source, "merchant_direct")
})

test("a waiting stamp-cycle reward drives the revealed ticket, not the ready state", () => {
  const counts = buildRewardCountsByMembership([
    row({
      id: "stamp_wait",
      source: "stamp_cycle",
      redeemable_from: FUTURE,
      reward_name: "Free pastry",
    }),
  ])
  const mem = counts.get("mem_1")

  assert.equal(mem.stampRewardId, null)
  assert.equal(mem.revealedRewardName, "Free pastry")
  assert.equal(mem.revealedRewardRedeemableFrom, FUTURE)
  assert.equal(mem.stampUnlocked, 1)
  assert.equal(mem.gift, null)
})

test("getTopRedeemable surfaces a redeemable gift when there is no earned reward", () => {
  const counts = buildRewardCountsByMembership([
    row({
      id: "gift_ready",
      source: "birthday_month",
      reward_name: "Birthday fizz",
    }),
  ])
  const cards = [{ membershipId: "mem_1", businessName: "Old Crown" }]

  const top = getTopRedeemable(cards, counts)

  // The collect-now banner stays cross-source so a gift still nudges.
  assert.equal(top?.rewardId, "gift_ready")
  assert.equal(top?.rewardName, "Birthday fizz")
  assert.equal(top?.businessName, "Old Crown")
})

test("getTopRedeemable prefers the earned stamp reward over a gift on the same card", () => {
  const counts = buildRewardCountsByMembership([
    row({ id: "stamp_ready", source: "stamp_cycle", reward_name: "Free coffee" }),
    row({
      id: "gift_ready",
      source: "birthday_month",
      reward_name: "Birthday fizz",
    }),
  ])
  const cards = [{ membershipId: "mem_1", businessName: "Old Crown" }]

  assert.equal(getTopRedeemable(cards, counts)?.rewardId, "stamp_ready")
})

test("getTopRedeemable ignores a gift that is not yet redeemable", () => {
  const counts = buildRewardCountsByMembership([
    row({ id: "gift_wait", source: "birthday_month", redeemable_from: FUTURE }),
  ])
  const cards = [{ membershipId: "mem_1", businessName: "Old Crown" }]

  assert.equal(getTopRedeemable(cards, counts), undefined)
})
