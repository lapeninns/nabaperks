import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatNextStampFrom,
  nextStampAvailableAt,
  nextStampLine,
  parseTradingDayStart,
  stampedTodayLine,
  venueTradingDateAt,
} from "@/lib/customer/experience/next-stamp"

test("Given a summer trading day When the next stamp is worked out Then it opens next day at the start, London time", () => {
  const at = nextStampAvailableAt({
    tradingDate: "2026-09-30",
    tradingDayStartsAt: "06:00:00",
  })
  assert.equal(at, "2026-10-01T05:00:00.000Z")
  assert.equal(formatNextStampFrom(at), "Thu 1 Oct, 06:00")
  assert.equal(nextStampLine(at), "Next stamp from Thu 1 Oct, 06:00.")
  assert.equal(stampedTodayLine(at), "Next stamp from Thu 1 Oct, 06:00.")
})

test("Given a winter trading day When the next stamp is worked out Then London and UTC agree", () => {
  const at = nextStampAvailableAt({
    tradingDate: "2026-11-10",
    tradingDayStartsAt: "05:00",
  })
  assert.equal(at, "2026-11-11T05:00:00.000Z")
  assert.equal(formatNextStampFrom(at), "Wed 11 Nov, 05:00")
})

test("Given the night the clocks go forward When the start is after the change Then the summer offset applies", () => {
  // British Summer Time starts at 01:00 UTC on Sunday 28 March 2027.
  const at = nextStampAvailableAt({
    tradingDate: "2027-03-27",
    tradingDayStartsAt: "05:00",
  })
  assert.equal(at, "2027-03-28T04:00:00.000Z")
  assert.equal(formatNextStampFrom(at), "Sun 28 Mar, 05:00")
})

test("Given a start inside the skipped hour When the clocks go forward Then the stamp opens as the clocks jump", () => {
  // 01:30 never happens in London that morning: 01:00 GMT becomes 02:00 BST.
  // The trading date computed from the wall clock moves on at the jump.
  const at = nextStampAvailableAt({
    tradingDate: "2027-03-27",
    tradingDayStartsAt: "01:30",
  })
  assert.equal(at, "2027-03-28T01:00:00.000Z")
  assert.equal(formatNextStampFrom(at), "Sun 28 Mar, 02:00")
  assert.equal(venueTradingDateAt(new Date(at), "01:30"), "2027-03-28")
  assert.equal(
    venueTradingDateAt(new Date("2027-03-28T00:59:00.000Z"), "01:30"),
    "2027-03-27"
  )
})

test("Given the night the clocks go back When the start is after the change Then the winter offset applies", () => {
  // British Summer Time ends at 01:00 UTC on Sunday 25 October 2026.
  const at = nextStampAvailableAt({
    tradingDate: "2026-10-24",
    tradingDayStartsAt: "05:00",
  })
  assert.equal(at, "2026-10-25T05:00:00.000Z")
  assert.equal(formatNextStampFrom(at), "Sun 25 Oct, 05:00")
})

test("Given a start inside the repeated hour When the clocks go back Then the first occurrence opens the stamp", () => {
  const at = nextStampAvailableAt({
    tradingDate: "2026-10-24",
    tradingDayStartsAt: "01:30",
  })
  assert.equal(at, "2026-10-25T00:30:00.000Z")
  assert.equal(formatNextStampFrom(at), "Sun 25 Oct, 01:30")
})

test("Given a time before the day start When the trading date is read Then it is still the previous day", () => {
  // 04:00 London on 1 October with a 05:00 start belongs to 30 September, so
  // the next stamp is later that same calendar morning, not a day later.
  const early = new Date("2026-10-01T03:00:00.000Z")
  const tradingDate = venueTradingDateAt(early, "05:00")
  assert.equal(tradingDate, "2026-09-30")
  const at = nextStampAvailableAt({ tradingDate, tradingDayStartsAt: "05:00" })
  assert.equal(at, "2026-10-01T04:00:00.000Z")
  assert.equal(formatNextStampFrom(at), "Thu 1 Oct, 05:00")
})

test("Given a time after the day start When the trading date is read Then it is today and the next stamp is tomorrow", () => {
  const late = new Date("2026-10-01T04:30:00.000Z")
  const tradingDate = venueTradingDateAt(late, "05:00")
  assert.equal(tradingDate, "2026-10-01")
  assert.equal(
    nextStampAvailableAt({ tradingDate, tradingDayStartsAt: "05:00" }),
    "2026-10-02T04:00:00.000Z"
  )
  // Exactly at the start the new day has begun.
  assert.equal(
    venueTradingDateAt(new Date("2026-10-01T04:00:00.000Z"), "05:00"),
    "2026-10-01"
  )
  assert.equal(
    venueTradingDateAt(new Date("2026-10-01T03:59:59.000Z"), "05:00"),
    "2026-09-30"
  )
})

test("Given a midnight start When the next stamp is worked out Then it opens at 00:00", () => {
  const at = nextStampAvailableAt({
    tradingDate: "2026-12-31",
    tradingDayStartsAt: "00:00:00",
  })
  assert.equal(at, "2027-01-01T00:00:00.000Z")
  assert.equal(formatNextStampFrom(at), "Fri 1 Jan, 00:00")
})

test("Given a start with seconds When it is shown Then the first open whole minute is named", () => {
  const at = nextStampAvailableAt({
    tradingDate: "2026-11-10",
    tradingDayStartsAt: "05:30:15",
  })
  assert.equal(at, "2026-11-11T05:30:15.000Z")
  assert.equal(formatNextStampFrom(at), "Wed 11 Nov, 05:31")
})

test("Given inputs the rule cannot trust When the next stamp is asked for Then the copy falls back to the next visit", () => {
  for (const [tradingDate, tradingDayStartsAt] of [
    [null, "05:00"],
    ["2026-09-30", null],
    ["2026-09-30", "13:00"],
    ["2026-09-30", "25:00"],
    ["2026-09-30", "5am"],
    ["2026-02-30", "05:00"],
    ["30/09/2026", "05:00"],
  ]) {
    assert.equal(
      nextStampAvailableAt({ tradingDate, tradingDayStartsAt }),
      null,
      `${tradingDate} ${tradingDayStartsAt}`
    )
  }
  assert.equal(parseTradingDayStart("12:00"), 12 * 3600)
  assert.equal(parseTradingDayStart("12:00:01"), null)
  assert.equal(formatNextStampFrom("not a date"), null)
  assert.equal(
    nextStampLine(null),
    "You can get your next stamp on your next visit."
  )
  assert.equal(stampedTodayLine(undefined), "Come back on your next visit.")
})

test("Given any next-stamp copy Then it never uses the words the brief rules out", () => {
  const lines = [
    nextStampLine("2026-10-01T05:00:00.000Z"),
    nextStampLine(null),
    stampedTodayLine("2026-10-01T05:00:00.000Z"),
    stampedTodayLine(null),
  ]
  for (const line of lines) {
    assert.doesNotMatch(line, /tomorrow|trading day|daily reset|!|—/i, line)
  }
})
