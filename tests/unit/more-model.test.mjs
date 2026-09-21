import assert from "node:assert/strict"
import { test } from "node:test"

import { buildMoreRows, formatMoreDate } from "@/lib/merchant/more-model"

const FULL = {
  posterPrinted: true,
  memberCount: 1842,
  activeOfferName: "Two-stamp Tuesday",
  lastAnnouncementAt: "2026-09-19T17:30:00.000Z",
  setup: { completed: 5, total: 5, launchReady: true },
  billingStatus: "active",
  trialDaysLeft: null,
}

test("every row carries a live subtitle and the setup row hides once launch is ready", () => {
  const rows = buildMoreRows(FULL)
  assert.deepEqual(
    rows.map((row) => [row.key, row.href, row.subtitle]),
    [
      ["poster", "/app/qr", "Printed"],
      ["members", "/app/customers", "1,842 on the card"],
      ["offers", "/app/offers", "Two-stamp Tuesday"],
      ["announce", "/app/announcements", "Last sent Sat 19 Sep"],
      ["account", "/app/account?tab=profile", "Billing active"],
    ]
  )
})

test("setup shows steps left while launch is incomplete, and quiet states read plainly", () => {
  const rows = buildMoreRows({
    ...FULL,
    posterPrinted: false,
    activeOfferName: "",
    lastAnnouncementAt: "",
    setup: { completed: 3, total: 5, launchReady: false },
    billingStatus: "not_started",
  })
  assert.equal(
    rows.find((row) => row.key === "poster").subtitle,
    "Not yet printed"
  )
  assert.equal(
    rows.find((row) => row.key === "offers").subtitle,
    "None running"
  )
  assert.equal(
    rows.find((row) => row.key === "announce").subtitle,
    "Never sent"
  )
  assert.equal(
    rows.find((row) => row.key === "setup").subtitle,
    "2 of 5 steps left"
  )
  assert.equal(
    rows.find((row) => row.key === "account").subtitle,
    "Billing not started"
  )
})

test("a failed read leaves the row without a subtitle; the trial chip is Account only", () => {
  const rows = buildMoreRows({
    posterPrinted: null,
    memberCount: null,
    activeOfferName: null,
    lastAnnouncementAt: null,
    setup: null,
    billingStatus: null,
    trialDaysLeft: null,
  })
  assert.equal(rows.length, 5)
  assert.ok(rows.every((row) => row.subtitle === null))

  const trial = buildMoreRows({
    ...FULL,
    billingStatus: "trialing",
    trialDaysLeft: 12,
  })
  assert.equal(trial.find((row) => row.key === "account").chip, "12 days left")
  assert.ok(trial.filter((row) => row.chip).length === 1)
})

test("the announcement date is a London short date", () => {
  assert.equal(formatMoreDate("2026-09-19T23:30:00.000Z"), "Sun 20 Sep")
  assert.equal(formatMoreDate("nope"), "recently")
})
