import assert from "node:assert/strict"
import { test } from "node:test"

import {
  dataRequestAgeCopy,
  describeDataRequestAge,
} from "@/lib/admin/data-request-status"

test("describeDataRequestAge uses one calendar month and clamps short months", () => {
  assert.deepEqual(
    describeDataRequestAge(
      "2027-01-31T12:00:00.000Z",
      new Date("2027-02-27T12:00:00.000Z")
    ),
    { days: 27, remainingDays: 1, overdue: false }
  )
  assert.deepEqual(
    describeDataRequestAge(
      "2027-01-31T12:00:00.000Z",
      new Date("2027-02-28T12:00:00.000Z")
    ),
    { days: 28, remainingDays: 0, overdue: false }
  )
  assert.deepEqual(
    describeDataRequestAge(
      "2027-01-31T12:00:00.000Z",
      new Date("2027-03-01T12:00:00.000Z")
    ),
    { days: 29, remainingDays: -1, overdue: true }
  )
})

test("describeDataRequestAge honours 31-day months and UK calendar dates", () => {
  assert.deepEqual(
    describeDataRequestAge(
      "2026-07-01T12:00:00.000Z",
      new Date("2026-08-01T12:00:00.000Z")
    ),
    { days: 31, remainingDays: 0, overdue: false }
  )
  assert.deepEqual(
    describeDataRequestAge(
      "2026-07-30T23:30:00.000Z",
      new Date("2026-08-31T22:30:00.000Z")
    ),
    { days: 31, remainingDays: 0, overdue: false }
  )
})

test("describeDataRequestAge never returns a negative age for a future request", () => {
  assert.deepEqual(
    describeDataRequestAge(
      "2026-08-01T12:00:00.000Z",
      new Date("2026-07-01T12:00:00.000Z")
    ),
    { days: 0, remainingDays: 31, overdue: false }
  )
})

test("dataRequestAgeCopy reads as calm en-GB status lines", () => {
  assert.equal(
    dataRequestAgeCopy({ days: 0, remainingDays: 28, overdue: false }),
    "Logged today · 28 days left until the one-calendar-month deadline"
  )
  assert.equal(
    dataRequestAgeCopy({ days: 1, remainingDays: 27, overdue: false }),
    "Logged 1 day ago · 27 days left until the one-calendar-month deadline"
  )
  assert.equal(
    dataRequestAgeCopy({ days: 28, remainingDays: 0, overdue: false }),
    "Logged 28 days ago · due today"
  )
  assert.equal(
    dataRequestAgeCopy({ days: 29, remainingDays: -1, overdue: true }),
    "Logged 29 days ago · 1 day past the one-calendar-month deadline"
  )
  assert.equal(
    dataRequestAgeCopy({ days: 45, remainingDays: -15, overdue: true }),
    "Logged 45 days ago · 15 days past the one-calendar-month deadline"
  )
})
