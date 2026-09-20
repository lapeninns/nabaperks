import assert from "node:assert/strict"
import { test } from "node:test"

import {
  addUkCalendarDays,
  formatLondonIso,
  formatRewardReadyDate,
  formatStampDisplayDateFromIso,
} from "@/lib/customer/uk-calendar"

test("Given UK DST start dates When calendar days are added Then local dates stay monotonic", () => {
  assert.equal(addUkCalendarDays("2026-03-28", 1), "2026-03-29")
  assert.equal(addUkCalendarDays("2026-03-29", 1), "2026-03-30")
  assert.equal(addUkCalendarDays("2026-03-30", -1), "2026-03-29")
})

test("Given UK DST end dates When calendar days are added Then local dates stay monotonic", () => {
  assert.equal(addUkCalendarDays("2026-10-24", 1), "2026-10-25")
  assert.equal(addUkCalendarDays("2026-10-25", 1), "2026-10-26")
  assert.equal(addUkCalendarDays("2026-10-26", -1), "2026-10-25")
})

test("Given leap year and year boundary dates When calendar days are added Then valid UK dates are returned", () => {
  assert.equal(addUkCalendarDays("2024-02-28", 1), "2024-02-29")
  assert.equal(addUkCalendarDays("2024-02-29", 1), "2024-03-01")
  assert.equal(addUkCalendarDays("2026-12-31", 1), "2027-01-01")
})

test("Given a timestamp around midnight UTC When formatted for London Then the UK business date is used", () => {
  assert.equal(
    formatLondonIso(new Date("2026-07-01T22:59:59.000Z")),
    "2026-07-01"
  )
  assert.equal(
    formatLondonIso(new Date("2026-07-01T23:00:00.000Z")),
    "2026-07-02"
  )
})

test("Given ISO dates When display labels are formatted Then they use short British receipt copy", () => {
  assert.equal(formatStampDisplayDateFromIso("2026-06-14"), "14 JUN")
  assert.equal(formatRewardReadyDate("2026-06-18"), "Thu 18 Jun")
  // The collection predicate reports a timestamptz; it is read on the London
  // calendar rather than split as a date-only string.
  assert.equal(formatRewardReadyDate("2026-07-03T05:00:00Z"), "Fri 3 Jul")
  assert.equal(formatRewardReadyDate("2026-07-02T23:30:00.000Z"), "Fri 3 Jul")
  assert.equal(formatRewardReadyDate("2026-12-31T23:30:00Z"), "Thu 31 Dec")
})

test("Receipt dates stay deterministic across months, including Safari's September abbreviation", () => {
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ]
  for (const [index, month] of months.entries()) {
    assert.equal(
      formatStampDisplayDateFromIso(
        `2026-${String(index + 1).padStart(2, "0")}-12`
      ),
      `12 ${month}`
    )
  }
  assert.equal(formatRewardReadyDate("2026-09-12"), "Sat 12 Sep")
  assert.equal(formatRewardReadyDate("2026-12-31"), "Thu 31 Dec")
  assert.equal(formatRewardReadyDate("2027-01-01"), "Fri 1 Jan")
})
