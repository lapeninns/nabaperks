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
})
