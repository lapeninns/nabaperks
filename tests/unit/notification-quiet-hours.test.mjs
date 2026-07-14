import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isWithinQuietHours,
  londonBusinessDate,
  londonMinutes,
  nextQuietHoursEnd,
} from "@/lib/notifications/london-time"

/**
 * notifications — quiet-hours + business-date time math (unit tier).
 *
 * Real execution of the pure Europe/London helpers extracted from the delivery
 * worker. Dates are expressed as UTC instants; London is UTC+1 in summer (BST)
 * and UTC+0 in winter (GMT), so the cases below deliberately straddle both to
 * prove the Intl conversion, the wrap-past-midnight window, and the inclusive
 * start / exclusive end boundaries.
 */

const NINE_AM = 9 * 60

test("default quiet hours (21:00–09:00) wrap past midnight", () => {
  // BST (UTC+1): add 1h to get London wall-clock.
  assert.equal(isWithinQuietHours(new Date("2026-07-01T22:30:00Z")), true, "23:30 BST is quiet")
  assert.equal(isWithinQuietHours(new Date("2026-07-01T23:30:00Z")), true, "00:30 BST is quiet")
  assert.equal(isWithinQuietHours(new Date("2026-07-01T07:30:00Z")), true, "08:30 BST is quiet")
  assert.equal(isWithinQuietHours(new Date("2026-07-01T12:00:00Z")), false, "13:00 BST is awake")
  assert.equal(isWithinQuietHours(new Date("2026-07-01T19:30:00Z")), false, "20:30 BST is awake")
})

test("the window is inclusive of start (21:00) and exclusive of end (09:00)", () => {
  assert.equal(isWithinQuietHours(new Date("2026-07-01T20:00:00Z")), true, "exactly 21:00 BST is quiet")
  assert.equal(isWithinQuietHours(new Date("2026-07-01T08:00:00Z")), false, "exactly 09:00 BST is awake")
})

test("winter (GMT) is handled without a DST off-by-one", () => {
  // GMT (UTC+0): London == UTC.
  assert.equal(isWithinQuietHours(new Date("2026-01-15T22:30:00Z")), true, "22:30 GMT is quiet")
  assert.equal(isWithinQuietHours(new Date("2026-01-15T12:00:00Z")), false, "12:00 GMT is awake")
})

test("a custom window and a degenerate (start == end) window", () => {
  // Custom 23:00–06:00.
  assert.equal(isWithinQuietHours(new Date("2026-01-15T23:30:00Z"), "23:00", "06:00"), true)
  assert.equal(isWithinQuietHours(new Date("2026-01-15T22:30:00Z"), "23:00", "06:00"), false)
  // start == end → never quiet.
  assert.equal(isWithinQuietHours(new Date("2026-01-15T03:00:00Z"), "09:00", "09:00"), false)
})

test("nextQuietHoursEnd returns the next 09:00 London, always in the future", () => {
  for (const iso of [
    "2026-07-01T23:30:00Z", // 00:30 BST → today's 09:00
    "2026-07-01T10:00:00Z", // 11:00 BST → tomorrow's 09:00
    "2026-01-15T22:30:00Z", // 22:30 GMT → tomorrow's 09:00
  ]) {
    const input = new Date(iso)
    const end = nextQuietHoursEnd(input)
    assert.ok(end > input, `${iso}: end is in the future`)
    assert.equal(londonMinutes(end), NINE_AM, `${iso}: lands at 09:00 London`)
  }
})

test("londonBusinessDate uses the London calendar day, not UTC", () => {
  // 23:00 BST on Jul 1 (22:00Z) is still Jul 1 in London.
  assert.equal(londonBusinessDate(new Date("2026-07-01T22:00:00Z")), "2026-07-01")
  // 00:30 BST on Jul 2 (23:30Z Jul 1) has rolled over to Jul 2 in London.
  assert.equal(londonBusinessDate(new Date("2026-07-01T23:30:00Z")), "2026-07-02")
})
