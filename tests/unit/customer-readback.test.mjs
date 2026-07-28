import assert from "node:assert/strict"
import { test } from "node:test"

import {
  assertMerchantCustomerRewardStateLoaded,
  buildMerchantCustomerReadback,
} from "@/lib/merchant/customer-readback"

const now = new Date("2026-06-30T12:00:00.000Z")

function customerRow(overrides = {}) {
  return {
    id: "membership_1",
    current_stamp_count: 8,
    total_stamps_earned: 8,
    total_rewards_redeemed: 0,
    last_visit_at: "2026-06-30T10:00:00.000Z",
    created_at: "2026-06-01T10:00:00.000Z",
    stamps_required: 8,
    customer: {
      email: "customer@example.com",
      phone: "07123456789",
      phone_last4: "6789",
    },
    activeReward: {
      id: "reward_event_1",
      redeemable_from: "2026-06-30",
    },
    last_redeemed_at: null,
    ...overrides,
  }
}

test("ready reward rows do not expose a reward event id as a scan token", () => {
  const row = buildMerchantCustomerReadback(customerRow(), now)

  assert.deepEqual(row.badge, {
    label: "Reward ready",
    tone: "ready",
    redeemable: true,
  })
  assert.equal("scanRewardId" in row, false)
})

test("customer readback DTO keeps raw email and phone out of client rows", () => {
  const rawEmail = "customer+vip@example.com"
  const rawPhone = "+44 7700 900123"
  const row = buildMerchantCustomerReadback(
    customerRow({
      customer: {
        email: rawEmail,
        phone: rawPhone,
        phone_last4: "0123",
      },
    }),
    now
  )

  assert.equal(row.identifier, "c***@example.com")
  assert.equal(row.phoneLine, "07 ··· ··· 23")

  const serialized = JSON.stringify(row)

  assert.equal(serialized.includes(rawEmail), false)
  assert.equal(serialized.includes(rawPhone), false)
  assert.equal(serialized.includes("customer+vip"), false)
  assert.equal(serialized.includes("0123"), false)
})

test("phone-only customer readback exposes only a masked phone ending", () => {
  const rawPhone = "+44 7700 900123"
  const row = buildMerchantCustomerReadback(
    customerRow({
      customer: {
        email: null,
        phone: rawPhone,
        phone_last4: "0123",
      },
    }),
    now
  )

  assert.equal(row.identifier, "Phone ending 0123")
  assert.equal(row.phoneLine, null)

  const serialized = JSON.stringify(row)

  assert.equal(serialized.includes(rawPhone), false)
})

test("customer readback DTO omits server-only identity and reward internals", () => {
  const row = buildMerchantCustomerReadback(customerRow(), now)
  const keys = Object.keys(row).sort()

  assert.deepEqual(keys, [
    "badge",
    "currentStampCount",
    "id",
    "identifier",
    "initials",
    "joinedIso",
    "joinedLabel",
    "lastVisitIso",
    "lastVisitLabel",
    "phoneLine",
    "rewardsRedeemed",
    "stampsRequired",
    "totalStampsEarned",
  ])

  assert.equal("customer" in row, false)
  assert.equal("activeReward" in row, false)
})

test("customer reward-state reads fail instead of inventing empty status", () => {
  const successfulReads = {
    activeCard: null,
    unlockedRewards: null,
    redemptions: null,
  }

  assert.doesNotThrow(() =>
    assertMerchantCustomerRewardStateLoaded(successfulReads)
  )

  for (const [key, expectedLabel] of [
    ["activeCard", "card status"],
    ["unlockedRewards", "reward status"],
    ["redemptions", "redemption status"],
  ]) {
    assert.throws(
      () =>
        assertMerchantCustomerRewardStateLoaded({
          ...successfulReads,
          [key]: { message: "database unavailable" },
        }),
      new RegExp(
        `Unable to load customer ${expectedLabel}: database unavailable`
      )
    )
  }
})
