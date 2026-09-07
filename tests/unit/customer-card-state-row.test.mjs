import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseCustomerCardStateRow,
  toRewardSummary,
} from "@/lib/customer/card-state-row"

const ready = {
  status: "ready",
  membership: {
    id: "m1",
    merchant_id: "mer1",
    customer_id: "c1",
    current_stamp_count: 3,
    total_rewards_redeemed: 1,
    active_cycle_number: 2,
    referral_code: "ABCD1234",
    referral_code_active: true,
  },
  merchant: {
    business_name: "The Old Crown",
    business_slug: "old-crown",
    status: "active",
    requires_billing: true,
    pub_google_review: null,
    locals: "Cambridge",
  },
  loyalty_card: {
    card_name: "Coffee card",
    stamps_required: 6,
    reward_name: "Free coffee",
    reward_terms: "One per visit.",
    is_active: true,
  },
  unlocked_rewards: [
    {
      id: "r1",
      status: "unlocked",
      reward_name: "Free coffee",
      reward_terms: "One per visit.",
      redeemable_from: "2026-09-08",
      expires_at: "2026-10-08T00:00:00+00:00",
      source: "stamp_cycle",
      created_at: "2026-09-07T10:00:00+00:00",
    },
  ],
  billing_status: "trialing",
}

test("not_found and unauthorized pass through as bare statuses", () => {
  assert.deepEqual(parseCustomerCardStateRow({ status: "not_found" }), {
    status: "not_found",
  })
  assert.deepEqual(parseCustomerCardStateRow({ status: "unauthorized" }), {
    status: "unauthorized",
  })
})

test("a ready payload narrows every field the card surfaces use", () => {
  const parsed = parseCustomerCardStateRow(ready)
  assert.equal(parsed.status, "ready")
  if (parsed.status !== "ready") return
  assert.equal(parsed.membership.customer_id, "c1")
  assert.equal(parsed.membership.current_stamp_count, 3)
  assert.equal(parsed.merchant.requires_billing, true)
  assert.equal(parsed.loyaltyCard?.stamps_required, 6)
  assert.equal(parsed.unlockedRewards[0]?.redeemable_from, "2026-09-08")
  assert.equal(parsed.billingStatus, "trialing")
})

test("a merchant with no card and no rewards is a ready card with nulls, not a failure", () => {
  const parsed = parseCustomerCardStateRow({
    ...ready,
    loyalty_card: null,
    unlocked_rewards: [],
    billing_status: null,
  })
  assert.equal(parsed.status, "ready")
  if (parsed.status !== "ready") return
  assert.equal(parsed.loyaltyCard, null)
  assert.deepEqual(parsed.unlockedRewards, [])
  assert.equal(parsed.billingStatus, null)
})

test("a malformed payload throws rather than rendering a wrong card", () => {
  for (const input of [
    null,
    { status: "ready" },
    { ...ready, membership: { ...ready.membership, id: 42 } },
    { ...ready, unlocked_rewards: [{ status: "unlocked" }] },
    { ...ready, loyalty_card: "nope" },
    { status: "surprise" },
  ]) {
    assert.throws(
      () => parseCustomerCardStateRow(input),
      /Unable to load customer card: malformed state/
    )
  }
})

test("toRewardSummary drops created_at and keeps the redeem window", () => {
  assert.deepEqual(toRewardSummary(ready.unlocked_rewards[0]), {
    id: "r1",
    status: "unlocked",
    reward_name: "Free coffee",
    reward_terms: "One per visit.",
    redeemable_from: "2026-09-08",
    expires_at: "2026-10-08T00:00:00+00:00",
    source: "stamp_cycle",
  })
  assert.equal(toRewardSummary(null), null)
})
