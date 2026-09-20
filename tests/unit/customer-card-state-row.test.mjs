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
    policy_cutover_notice_at: "2026-09-19T09:00:00Z",
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
    minimum_spend_pence: 500,
    one_transaction_per_stamp: true,
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
      collection_state: "waiting",
      collection_reason: null,
      available_from: "2026-09-08T05:00:00+00:00",
      in_window: false,
      window_id: null,
      window_ends_at: null,
      upgrade_pool_item_id: null,
      upgrade_reward_name: null,
      upgrade_reward_terms: null,
      next_window_starts_at: "2026-09-09T12:00:00+00:00",
      next_window_ends_at: "2026-09-09T15:00:00+00:00",
      next_window_upgrade_name: "Free starter",
      requires_age_check: false,
      reward_policy_snapshot: {
        age_check: false,
        minimum_spend_pence: 500,
        one_transaction_per_stamp: true,
      },
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
  assert.equal(parsed.membership.policy_cutover_notice_at, "2026-09-19T09:00:00Z")
  assert.equal(parsed.merchant.requires_billing, true)
  assert.equal(parsed.loyaltyCard?.stamps_required, 6)
  assert.equal(parsed.unlockedRewards[0]?.redeemable_from, "2026-09-08")
  assert.equal(parsed.unlockedRewards[0]?.collection_state, "waiting")
  assert.equal(parsed.unlockedRewards[0]?.requires_age_check, false)
  assert.match(parsed.unlockedRewards[0]?.earning_terms ?? "", /£5\.00/)
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
      /malformed (collection )?state/
    )
  }
})

test("toRewardSummary drops created_at and keeps the server collection state", () => {
  const parsed = parseCustomerCardStateRow(ready)
  assert.equal(parsed.status, "ready")
  if (parsed.status !== "ready") return
  assert.deepEqual(toRewardSummary(parsed.unlockedRewards[0]), {
    id: "r1",
    status: "unlocked",
    reward_name: "Free coffee",
    reward_terms: "One per visit.",
    redeemable_from: "2026-09-08",
    expires_at: "2026-10-08T00:00:00+00:00",
    source: "stamp_cycle",
    collection_state: "waiting",
    collection_reason: null,
    available_from: "2026-09-08T05:00:00+00:00",
    in_window: false,
    window_id: null,
    window_ends_at: null,
    upgrade_pool_item_id: null,
    upgrade_reward_name: null,
    upgrade_reward_terms: null,
    next_window_starts_at: "2026-09-09T12:00:00+00:00",
    next_window_ends_at: "2026-09-09T15:00:00+00:00",
    next_window_upgrade_name: "Free starter",
    requires_age_check: false,
    earning_terms:
      "One stamp per visit, one transaction per stamp. Minimum spend £5.00.",
  })
  assert.equal(toRewardSummary(null), null)
})
