import assert from "node:assert/strict"
import { test } from "node:test"

import {
  groupRewardsForList,
  rewardListGroup,
} from "@/lib/customer/reward-list-groups"

const PHOTO_ID =
  "Customer must have verified photo ID and be 18 or over to redeem"

test("rewards are grouped by what the guest can do with them", () => {
  assert.equal(rewardListGroup("ready", null), "redeemable")
  assert.equal(rewardListGroup("blocked", PHOTO_ID), "redeemable")
  assert.equal(
    rewardListGroup("blocked", "Complete your profile before redeeming"),
    "needsSetup"
  )
  assert.equal(
    rewardListGroup("blocked", "Verified email required for reward collection"),
    "needsSetup"
  )
  assert.equal(rewardListGroup("waiting", null), "upcoming")
  // A venue-side hold is not something the guest can set up.
  assert.equal(rewardListGroup("blocked", "venue_paused"), "upcoming")
  assert.equal(rewardListGroup("blocked", "one_reward_per_day"), "upcoming")
  assert.equal(rewardListGroup("redeemed", null), "redeemed")
  assert.equal(rewardListGroup("expired", "expired"), "expired")
  assert.equal(rewardListGroup("cancelled", null), "expired")
})

test("a setup-blocked reward is never listed as ready to collect", () => {
  const groups = groupRewardsForList([
    { id: "a", collectionState: "ready", collectionReason: null },
    {
      id: "b",
      collectionState: "blocked",
      collectionReason: "Complete your profile before redeeming",
    },
    { id: "c", collectionState: "waiting", collectionReason: null },
  ])

  assert.deepEqual(
    groups.redeemable.map((item) => item.id),
    ["a"]
  )
  assert.deepEqual(
    groups.needsSetup.map((item) => item.id),
    ["b"]
  )
  assert.deepEqual(
    groups.upcoming.map((item) => item.id),
    ["c"]
  )
  assert.deepEqual(groups.redeemed, [])
  assert.deepEqual(groups.expired, [])
})
