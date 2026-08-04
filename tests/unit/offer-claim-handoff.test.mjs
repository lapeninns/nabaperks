import assert from "node:assert/strict"
import { test } from "node:test"

import {
  FINAL_OFFER_CLAIM_STATUSES,
  claimHandoffOrder,
  isFinalOfferClaimOutcome,
} from "@/lib/offers/claim-handoff"

/**
 * The two join-path decisions that cost a customer their offer permanently when
 * they are made wrongly: which handoff runs first, and when the handoff cookie
 * is allowed to be thrown away.
 */

const HOUR_SECONDS = 60 * 60
const NOW = 1_800_000_000

/** Both cookies stamp an absolute expiry one hour after they are set. */
function startedSecondsAgo(seconds) {
  return NOW - seconds + HOUR_SECONDS
}

test("Given a stale invitation and a fresh offer When the order is resolved Then the offer runs first", () => {
  const order = claimHandoffOrder({
    invite: startedSecondsAgo(50 * 60),
    offer: startedSecondsAgo(5),
  })

  assert.deepEqual(order, ["offer", "invite"])
})

test("Given a stale offer and a fresh invitation When the order is resolved Then the invitation runs first", () => {
  const order = claimHandoffOrder({
    invite: startedSecondsAgo(5),
    offer: startedSecondsAgo(50 * 60),
  })

  assert.deepEqual(order, ["invite", "offer"])
})

test("Given only an offer handoff When the order is resolved Then both branches are still returned", () => {
  const order = claimHandoffOrder({
    invite: null,
    offer: startedSecondsAgo(5),
  })

  // The invitation branch has no cookie and falls straight through, so the order
  // between them is immaterial — but neither branch may be dropped.
  assert.equal(order.length, 2)
  assert.ok(order.includes("invite"))
  assert.ok(order.includes("offer"))
})

test("Given only an invitation handoff When the order is resolved Then both branches are still returned", () => {
  const order = claimHandoffOrder({
    invite: startedSecondsAgo(5),
    offer: null,
  })

  assert.deepEqual(order, ["invite", "offer"])
})

test("Given neither handoff When the order is resolved Then the historical order is kept", () => {
  assert.deepEqual(claimHandoffOrder({ invite: null, offer: null }), [
    "invite",
    "offer",
  ])
})

test("Given two claims started in the same second When the order is resolved Then the historical order is kept", () => {
  const sameSecond = startedSecondsAgo(30)

  assert.deepEqual(
    claimHandoffOrder({ invite: sameSecond, offer: sameSecond }),
    ["invite", "offer"]
  )
})

test("Given a settled claim outcome When finality is read Then the handoff may be spent", () => {
  for (const status of [
    "claimed",
    "already_claimed",
    "already_member",
    "expired",
    "not_started",
    "paused",
    "invalid",
  ]) {
    assert.equal(isFinalOfferClaimOutcome(status), true, status)
  }
})

test("Given a retryable claim outcome When finality is read Then the handoff is kept", () => {
  // These are the outcomes whose message invites the customer to try again. If
  // the cookie were cleared, the retry would be an ordinary join: no benefit,
  // and an existing membership that locks them out of the offer for good.
  for (const status of ["unavailable", "card_too_short"]) {
    assert.equal(isFinalOfferClaimOutcome(status), false, status)
  }
})

test("Given no status at all When finality is read Then the handoff is kept", () => {
  for (const status of [undefined, null, "", "Claimed", "future_status", " "]) {
    assert.equal(isFinalOfferClaimOutcome(status), false, String(status))
  }
})

test("Given the final-status registry When it is read Then it names the settled outcomes only", () => {
  assert.deepEqual([...FINAL_OFFER_CLAIM_STATUSES].sort(), [
    "already_claimed",
    "already_member",
    "claimed",
    "expired",
    "invalid",
    "not_started",
    "paused",
  ])
})
