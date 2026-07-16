import assert from "node:assert/strict"
import { test } from "node:test"

import {
  initialStampChoreographyState,
  readbackBonusStampsApplied,
  reduceStampChoreography,
  stampChoreographyView,
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
  assert.equal(view.announcement, "Stamp not added. You're already stamped today.")
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
