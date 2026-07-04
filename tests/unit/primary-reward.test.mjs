import assert from "node:assert/strict"
import { test } from "node:test"

import {
  comparePrimaryUnlockedRewards,
  pickPrimaryUnlockedReward,
  pickStampBlockingUnlockedReward,
} from "@/lib/customer/primary-reward"

const stampCycle = {
  id: "stamp-1",
  source: "stamp_cycle",
  created_at: "2026-07-01T10:00:00.000Z",
  redeemable_from: "2026-07-02",
}

const birthday = {
  id: "birthday-1",
  source: "birthday_month",
  created_at: "2026-07-03T10:00:00.000Z",
  redeemable_from: "2026-07-03",
}

test("pickPrimaryUnlockedReward prefers stamp_cycle over a newer birthday reward", () => {
  const picked = pickPrimaryUnlockedReward([birthday, stampCycle])
  assert.equal(picked?.id, "stamp-1")
})

test("pickStampBlockingUnlockedReward ignores issued rewards", () => {
  const picked = pickStampBlockingUnlockedReward([birthday])
  assert.equal(picked, null)

  const withCycle = pickStampBlockingUnlockedReward([birthday, stampCycle])
  assert.equal(withCycle?.id, "stamp-1")
})

test("comparePrimaryUnlockedRewards prefers redeemable rewards within the same source", () => {
  const waiting = {
    id: "stamp-waiting",
    source: "stamp_cycle",
    created_at: "2026-07-04T10:00:00.000Z",
    redeemable_from: "2026-07-10",
  }
  const ready = {
    id: "stamp-ready",
    source: "stamp_cycle",
    created_at: "2026-07-01T10:00:00.000Z",
    redeemable_from: "2026-07-01",
  }

  assert.ok(comparePrimaryUnlockedRewards(ready, waiting) < 0)
  assert.equal(pickPrimaryUnlockedReward([waiting, ready])?.id, "stamp-ready")
})
