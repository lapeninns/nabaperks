import assert from "node:assert/strict"
import { test } from "node:test"

import {
  comparePrimaryUnlockedRewards,
  pickIssuedUnlockedReward,
  pickPrimaryUnlockedReward,
  pickStampBlockingUnlockedReward,
} from "@/lib/customer/primary-reward"

const stampCycle = {
  id: "stamp-1",
  source: "stamp_cycle",
  created_at: "2026-07-01T10:00:00.000Z",
  collection_state: "ready",
}

const birthday = {
  id: "birthday-1",
  source: "birthday_month",
  created_at: "2026-07-03T10:00:00.000Z",
  collection_state: "ready",
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
    collection_state: "waiting",
  }
  const ready = {
    id: "stamp-ready",
    source: "stamp_cycle",
    created_at: "2026-07-01T10:00:00.000Z",
    collection_state: "ready",
  }

  assert.ok(comparePrimaryUnlockedRewards(ready, waiting) < 0)
  assert.equal(pickPrimaryUnlockedReward([waiting, ready])?.id, "stamp-ready")
})

test("pickIssuedUnlockedReward returns the issued gift and ignores stamp_cycle rewards", () => {
  assert.equal(
    pickIssuedUnlockedReward([stampCycle, birthday])?.id,
    "birthday-1"
  )
  assert.equal(pickIssuedUnlockedReward([stampCycle]), null)
  assert.equal(pickIssuedUnlockedReward([]), null)
})

test("pickIssuedUnlockedReward prefers a redeemable gift over a waiting one", () => {
  const waitingGift = {
    id: "bday-wait",
    source: "birthday_month",
    created_at: "2026-07-05T10:00:00.000Z",
    collection_state: "waiting",
  }
  const readyGift = {
    id: "bday-ready",
    source: "birthday_month",
    created_at: "2026-07-01T10:00:00.000Z",
    collection_state: "ready",
  }

  assert.equal(
    pickIssuedUnlockedReward([waitingGift, readyGift])?.id,
    "bday-ready"
  )
})

test("an older gift held only by a setup step outranks a newer waiting gift", () => {
  const setupBlocked = {
    id: "gift-setup",
    source: "birthday_month",
    created_at: "2026-07-01T10:00:00.000Z",
    collection_state: "blocked",
    collection_reason: "Verified email required for reward collection",
  }
  const newerWaiting = {
    id: "gift-waiting",
    source: "birthday_month",
    created_at: "2026-07-05T10:00:00.000Z",
    collection_state: "waiting",
  }
  const venueBlocked = {
    id: "gift-paused",
    source: "birthday_month",
    created_at: "2026-07-06T10:00:00.000Z",
    collection_state: "blocked",
    collection_reason: "venue_paused",
  }
  assert.equal(pickIssuedUnlockedReward([newerWaiting, setupBlocked])?.id, "gift-setup")
  // A block the customer cannot act on ranks like any other non-ready row.
  assert.equal(pickIssuedUnlockedReward([venueBlocked, newerWaiting])?.id, "gift-paused")
})
