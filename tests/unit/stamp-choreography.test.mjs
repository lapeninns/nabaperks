import assert from "node:assert/strict"
import { test } from "node:test"

import {
  initialStampChoreographyState,
  readbackBonusStampsApplied,
  reduceStampChoreography,
  stampChoreographyView,
  venueCodeOffered,
} from "@/lib/customer/experience/stamp-choreography"

const issued = {
  status: "issued",
  newStampCount: 5,
  rewardUnlocked: true,
  geoFlagged: false,
  bonusStampsApplied: 2,
}

const baseView = {
  canStamp: true,
  current: 2,
  total: 5,
  stampDates: ["14 Jul", "15 Jul"],
  todayLabel: "16 Jul",
  rewardUnlocked: false,
}

test("checking acknowledges process without changing authoritative progress", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const view = stampChoreographyView(checking, baseView)

  assert.equal(checking.phase, "checking")
  assert.equal(view.displayCurrent, 2)
  assert.deepEqual(view.dates, ["14 Jul", "15 Jul"])
  assert.equal(view.slamIndex, -1)
  assert.equal(view.cardComplete, false)
  assert.equal(view.ariaBusy, true)
  assert.equal(view.buttonLabel, "Checking today's stamp")
  assert.equal(view.announcement, "Checking today's stamp.")
})

test("issued progress comes from the server and slams the venue stamp slot", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const printing = reduceStampChoreography(checking, {
    type: "request_issued",
    result: issued,
  })
  const view = stampChoreographyView(printing, baseView)

  assert.equal(printing.phase, "printing")
  assert.equal(view.displayCurrent, 5)
  assert.equal(view.slamIndex, 2)
  assert.deepEqual(view.dates, ["14 Jul", "15 Jul", "16 Jul", "Bonus", "Bonus"])
  assert.equal(view.cardComplete, true)
  assert.equal(view.confirmed, true)
  assert.equal(view.rewardUnlocked, true)
  assert.equal(
    view.announcement,
    "Stamp added. That's the full card, your reward is unlocked."
  )
})

test("a fast server refresh cannot move the final stamp slam past its slot", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const result = {
    ...issued,
    bonusStampsApplied: 0,
  }
  const printing = reduceStampChoreography(checking, {
    type: "request_issued",
    result,
  })
  const view = stampChoreographyView(printing, {
    ...baseView,
    canStamp: false,
    current: 5,
    stampDates: ["12 Jul", "13 Jul", "14 Jul", "15 Jul", "16 Jul"],
    rewardUnlocked: true,
  })

  assert.equal(view.displayCurrent, 5)
  assert.equal(view.slamIndex, 4)
})

test("print completion settles without replaying the attempt", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const printing = reduceStampChoreography(checking, {
    type: "request_issued",
    result: issued,
  })
  const confirmed = reduceStampChoreography(printing, {
    type: "print_settled",
  })

  assert.equal(confirmed.phase, "confirmed")
  assert.equal(
    reduceStampChoreography(confirmed, { type: "print_settled" }),
    confirmed
  )
})

test("a domain block keeps progress unchanged and permits a fresh attempt", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const blocked = reduceStampChoreography(checking, {
    type: "request_blocked",
    message: "You're already stamped today.",
  })
  const view = stampChoreographyView(blocked, baseView)

  assert.equal(blocked.phase, "blocked")
  assert.equal(view.displayCurrent, 2)
  assert.equal(view.slamIndex, -1)
  assert.equal(view.secured, false)
  assert.equal(
    view.announcement,
    "Stamp not added. You're already stamped today."
  )
  assert.equal(
    reduceStampChoreography(blocked, { type: "request_started" }).phase,
    "checking"
  )
})

test("an unknown transport outcome requires authoritative readback", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const unknown = reduceStampChoreography(checking, {
    type: "request_unknown",
  })
  const view = stampChoreographyView(unknown, baseView)

  assert.equal(unknown.phase, "unknown")
  assert.equal(view.displayCurrent, 2)
  assert.equal(view.secured, true)
  assert.equal(view.ariaBusy, true)
  assert.equal(
    view.announcement,
    "We couldn't confirm the result. Checking your card."
  )

  const recovered = reduceStampChoreography(unknown, {
    type: "readback_issued",
    result: {
      ...issued,
      newStampCount: 4,
      rewardUnlocked: false,
      bonusStampsApplied: 0,
    },
  })
  assert.equal(recovered.phase, "printing")
  assert.equal(
    stampChoreographyView(recovered, {
      ...baseView,
      canStamp: false,
      current: 4,
      stampDates: ["13 Jul", "14 Jul", "15 Jul", "16 Jul"],
    }).slamIndex,
    3
  )
})

test("bonus readback keeps the venue slam on the first newly earned slot", () => {
  const bonusStampsApplied = readbackBonusStampsApplied(2, 5)
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const unknown = reduceStampChoreography(checking, {
    type: "request_unknown",
  })
  const recovered = reduceStampChoreography(unknown, {
    type: "readback_issued",
    result: {
      ...issued,
      bonusStampsApplied,
    },
  })
  const view = stampChoreographyView(recovered, {
    ...baseView,
    canStamp: false,
    current: 5,
    stampDates: ["12 Jul", "13 Jul", "16 Jul", "Bonus", "Bonus"],
    rewardUnlocked: true,
  })

  assert.equal(bonusStampsApplied, 2)
  assert.equal(view.slamIndex, 2)
})

test("an unchanged open readback unlocks a retry instead of staying secured", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const unknown = reduceStampChoreography(checking, {
    type: "request_unknown",
  })
  const retryable = reduceStampChoreography(unknown, {
    type: "request_blocked",
    message: "We couldn't confirm the stamp. Check your card, then try again.",
  })
  const view = stampChoreographyView(retryable, baseView)

  assert.equal(retryable.phase, "blocked")
  assert.equal(view.secured, false)
  assert.equal(view.buttonLabel, "Try today's stamp again")
  assert.equal(
    reduceStampChoreography(retryable, { type: "request_started" }).phase,
    "checking"
  )
})

test("an unchanged closed readback never invents an issued stamp", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const unknown = reduceStampChoreography(checking, {
    type: "request_unknown",
  })
  const closed = reduceStampChoreography(unknown, {
    type: "readback_closed",
  })
  const view = stampChoreographyView(closed, {
    ...baseView,
    canStamp: false,
  })

  assert.equal(closed.phase, "closed")
  assert.equal(view.displayCurrent, 2)
  assert.equal(view.confirmed, false)
  assert.equal(view.announcement, "Card updated. No new stamp was confirmed.")
  assert.equal(view.statusTitle, "Your card is up to date.")
})

test("a server-derived unlocked reward stays revealed after reload", () => {
  const view = stampChoreographyView(initialStampChoreographyState, {
    ...baseView,
    canStamp: false,
    current: 5,
    stampDates: ["12 Jul", "13 Jul", "14 Jul", "15 Jul", "16 Jul"],
    rewardUnlocked: true,
  })

  assert.equal(view.displayCurrent, 5)
  assert.equal(view.cardComplete, true)
  assert.equal(view.rewardUnlocked, true)
  assert.equal(view.confirmed, true)
  assert.equal(view.statusTitle, "That's the full card.")
  assert.equal(view.statusBody, "Your reward is ready to open.")
})

test("the venue-code fallback is offered for location refusals, throttles and wrong codes, never for a lockout", () => {
  assert.equal(venueCodeOffered("location_out_of_range"), true)
  assert.equal(venueCodeOffered("location_required"), true)
  assert.equal(venueCodeOffered("location_blocked"), true)
  // The stamp path being throttled is exactly when the code — with its own
  // throttle — is the way forward; hiding it here is how a member got stuck.
  assert.equal(venueCodeOffered("rate_limited"), true)
  assert.equal(venueCodeOffered("venue_code_rejected"), true)
  assert.equal(venueCodeOffered("venue_code_format"), true)
  assert.equal(venueCodeOffered("venue_code_locked"), false)
  assert.equal(venueCodeOffered("venue_code_refusal_missing"), false)
  assert.equal(venueCodeOffered("already_stamped_today"), false)
  assert.equal(venueCodeOffered(undefined), false)
})

test("a visit that must confirm location offers both methods before any refusal", () => {
  const plain = stampChoreographyView(initialStampChoreographyState, baseView)
  assert.equal(plain.locationControls, false)
  assert.equal(plain.venueCodeOffer, false)
  assert.equal(plain.statusTitle, "Ready for today's stamp.")

  const verified = stampChoreographyView(initialStampChoreographyState, {
    ...baseView,
    verificationRequired: true,
  })
  assert.equal(verified.locationControls, true)
  assert.equal(verified.venueCodeOffer, true)
  assert.equal(verified.secured, false)
  assert.equal(verified.statusTitle, "Confirm you're at the venue.")
  assert.match(verified.statusBody, /location, or enter today's code/)

  const closed = stampChoreographyView(initialStampChoreographyState, {
    ...baseView,
    canStamp: false,
    verificationRequired: true,
  })
  assert.equal(closed.locationControls, false, "nothing to confirm today")
  assert.equal(closed.venueCodeOffer, false)
})

test("asking the browser for a fix shows in the band without inking the card", () => {
  const view = stampChoreographyView(initialStampChoreographyState, {
    ...baseView,
    verificationRequired: true,
    acquiringLocation: true,
  })
  assert.equal(view.pendingIndex, -1, "nothing has been sent")
  assert.equal(view.pending, false, "the code form stays usable")
  assert.equal(view.ariaBusy, true)
  assert.equal(view.statusTitle, "Checking your location.")
  assert.match(view.statusBody, /enter today's venue code instead/)
  assert.equal(view.locationControls, true)
  assert.equal(view.venueCodeOffer, true)
})

test("a refusal decided on the phone blocks from idle, offers both methods, and spends no request", () => {
  const refused = reduceStampChoreography(initialStampChoreographyState, {
    type: "capture_refused",
    message: "Location is blocked for this site.",
  })
  assert.equal(refused.phase, "blocked")
  assert.equal(refused.reason, "location_blocked")

  const view = stampChoreographyView(refused, {
    ...baseView,
    verificationRequired: true,
  })
  assert.equal(view.venueCodeOffer, true)
  assert.equal(view.locationControls, true)
  assert.equal(view.statusBody, "Location is blocked for this site.")

  const inFlight = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  assert.equal(
    reduceStampChoreography(inFlight, {
      type: "capture_refused",
      message: "late",
    }),
    inFlight,
    "a request already in flight is never overwritten"
  )
})

test("a throttled stamp keeps the code on screen and says so", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const throttled = reduceStampChoreography(checking, {
    type: "request_blocked",
    message: "You're going a little fast. Wait a few minutes, then try again.",
    reason: "rate_limited",
  })
  const view = stampChoreographyView(throttled, {
    ...baseView,
    verificationRequired: true,
  })
  assert.equal(view.venueCodeOffer, true)
  assert.equal(view.locationControls, true)
  assert.match(view.statusBody, /Or enter today's venue code below\.$/)
  assert.doesNotMatch(
    view.announcement,
    /venue code below/,
    "the live region reads the refusal as the server put it"
  )
})

test("a lockout withholds both methods until it lifts", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const locked = reduceStampChoreography(checking, {
    type: "request_blocked",
    message: "Too many tries.",
    reason: "venue_code_locked",
    lockedUntil: "2026-09-11T20:00:00.000Z",
  })
  const view = stampChoreographyView(locked, {
    ...baseView,
    verificationRequired: true,
  })
  assert.equal(view.venueCodeOffer, false)
  assert.equal(view.locationControls, false)
  assert.equal(view.venueCodeLockedUntil, "2026-09-11T20:00:00.000Z")
})

test("an issued stamp says how the visit was confirmed when that matters", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const plain = {
    ...issued,
    newStampCount: 3,
    rewardUnlocked: false,
    bonusStampsApplied: 0,
  }
  const body = (result, extra = {}) =>
    stampChoreographyView(
      reduceStampChoreography(checking, { type: "request_issued", result }),
      { ...baseView, ...extra }
    ).statusBody

  assert.doesNotMatch(body(plain), /location|venue code/)
  assert.match(
    body({ ...plain, verification: "venue_code" }),
    /Confirmed using today's venue code\.$/
  )
  assert.match(
    body({ ...plain, geoFlagged: true, verification: "unverified" }),
    /Added without a location check\.$/,
    "with no grace count known, no number is invented"
  )
  assert.match(
    body(
      { ...plain, geoFlagged: true, verification: "unverified" },
      { unverifiedGraceRemaining: 2 }
    ),
    /1 more can be added without one\.$/
  )
  assert.match(
    body(
      { ...plain, geoFlagged: true, verification: "unverified" },
      { unverifiedGraceRemaining: 1 }
    ),
    /Next time, location or the venue code is needed\.$/
  )
})

test("a blocked view carries the fallback facts and a retry clears them", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const refused = reduceStampChoreography(checking, {
    type: "request_blocked",
    message: "Location couldn't confirm you're at the venue.",
    reason: "location_out_of_range",
  })
  const refusedView = stampChoreographyView(refused, baseView)
  assert.equal(refusedView.venueCodeOffer, true)
  assert.equal(refusedView.venueCodeAttemptsRemaining, null)
  assert.equal(refusedView.venueCodeLockedUntil, null)
  assert.equal(refusedView.secured, false, "the customer may try again")

  const retry = reduceStampChoreography(refused, { type: "request_started" })
  assert.equal(retry.phase, "checking")
  assert.equal(stampChoreographyView(retry, baseView).venueCodeOffer, false)

  const wrong = reduceStampChoreography(retry, {
    type: "request_blocked",
    message: "That code isn't right.",
    reason: "venue_code_rejected",
    attemptsRemaining: 3,
  })
  const wrongView = stampChoreographyView(wrong, baseView)
  assert.equal(wrongView.venueCodeOffer, true)
  assert.equal(wrongView.venueCodeAttemptsRemaining, 3)

  const locked = reduceStampChoreography(
    reduceStampChoreography(wrong, { type: "request_started" }),
    {
      type: "request_blocked",
      message: "Too many tries.",
      reason: "venue_code_locked",
      lockedUntil: "2026-09-07T12:15:00.000Z",
    }
  )
  const lockedView = stampChoreographyView(locked, baseView)
  assert.equal(lockedView.venueCodeOffer, false)
  assert.equal(lockedView.venueCodeLockedUntil, "2026-09-07T12:15:00.000Z")
})

test("a plain (non-location) refusal offers no fallback", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  const blocked = reduceStampChoreography(checking, {
    type: "request_blocked",
    message: "You're already stamped today.",
    reason: "already_stamped_today",
  })
  const view = stampChoreographyView(blocked, baseView)
  assert.equal(view.venueCodeOffer, false)
  assert.equal(view.venueCodeAttemptsRemaining, null)
  assert.equal(view.venueCodeLockedUntil, null)
})

test("the inking slot is anchored to the count captured at request start", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
    current: 2,
  })
  assert.equal(checking.phase, "checking")

  // Props unchanged: slot 3 (index 2) is inking.
  assert.equal(stampChoreographyView(checking, baseView).pendingIndex, 2)

  // Revalidated props arrive early with the landed stamp: nothing left to ink,
  // and never the *following* slot.
  const advanced = stampChoreographyView(checking, { ...baseView, current: 3 })
  assert.equal(advanced.pendingIndex, -1)
  assert.equal(advanced.displayCurrent, 3)

  // Without a snapshot the live count is the anchor (older callers).
  const legacy = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
  })
  assert.equal(stampChoreographyView(legacy, baseView).pendingIndex, 2)

  // A completing stamp on a full card has no empty slot to ink.
  const full = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
    current: 5,
  })
  assert.equal(
    stampChoreographyView(full, { ...baseView, current: 5 }).pendingIndex,
    -1
  )
})

test("no phase other than checking exposes an inking slot", () => {
  const checking = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
    current: 2,
  })
  const printing = reduceStampChoreography(checking, {
    type: "request_issued",
    result: { ...issued, newStampCount: 3, rewardUnlocked: false },
  })
  assert.equal(stampChoreographyView(printing, baseView).pendingIndex, -1)
  assert.equal(
    stampChoreographyView(initialStampChoreographyState, baseView).pendingIndex,
    -1
  )
})
