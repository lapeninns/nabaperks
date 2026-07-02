import assert from "node:assert/strict"
import { test } from "node:test"

import {
  DATA_REQUEST_WINDOW_DAYS,
  dataRequestAgeCopy,
  describeDataRequestAge,
} from "@/lib/admin/data-request-status"

const NOW = new Date("2026-07-02T12:00:00Z")

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

test("describeDataRequestAge counts whole elapsed days against the 30-day window", () => {
  assert.deepEqual(describeDataRequestAge(daysAgo(0), NOW), {
    days: 0,
    remainingDays: 30,
    overdue: false,
  })
  assert.deepEqual(describeDataRequestAge(daysAgo(12), NOW), {
    days: 12,
    remainingDays: 18,
    overdue: false,
  })
  assert.deepEqual(describeDataRequestAge(daysAgo(30), NOW), {
    days: 30,
    remainingDays: 0,
    overdue: false,
  })
})

test("describeDataRequestAge flags overdue requests and never returns negative age", () => {
  const overdue = describeDataRequestAge(daysAgo(45), NOW)
  assert.equal(overdue.days, 45)
  assert.equal(overdue.remainingDays, -15)
  assert.equal(overdue.overdue, true)

  // A clock-skewed future timestamp clamps to zero days old.
  const future = describeDataRequestAge(daysAgo(-2), NOW)
  assert.equal(future.days, 0)
  assert.equal(future.overdue, false)
})

test("dataRequestAgeCopy reads as calm en-GB status lines", () => {
  assert.equal(
    dataRequestAgeCopy(describeDataRequestAge(daysAgo(0), NOW)),
    "Logged today · 30 days left of the 30-day window"
  )
  assert.equal(
    dataRequestAgeCopy(describeDataRequestAge(daysAgo(1), NOW)),
    "Logged 1 day ago · 29 days left of the 30-day window"
  )
  assert.equal(
    dataRequestAgeCopy(describeDataRequestAge(daysAgo(29), NOW)),
    "Logged 29 days ago · 1 day left of the 30-day window"
  )
  assert.equal(
    dataRequestAgeCopy(describeDataRequestAge(daysAgo(31), NOW)),
    "Logged 31 days ago · 1 day over the 30-day window"
  )
  assert.equal(
    dataRequestAgeCopy(describeDataRequestAge(daysAgo(45), NOW)),
    "Logged 45 days ago · 15 days over the 30-day window"
  )
})

test("the window constant matches the statutory copy", () => {
  assert.equal(DATA_REQUEST_WINDOW_DAYS, 30)
})
