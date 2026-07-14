import assert from "node:assert/strict"
import { test } from "node:test"

import {
  birthdayRewardExpiresAt,
  currentBirthdayYear,
  isBirthdayMonth,
} from "@/lib/rewards/birthday"

/**
 * rewards customer birthday R-9 — pure London birthday-window math. Uses
 * explicit `now` instants (no Date.now) so the assertions are month-agnostic.
 */

// A July (BST) reference instant and a December (GMT) one.
const JULY = new Date("2026-07-15T12:00:00.000Z")
const DECEMBER = new Date("2026-12-10T12:00:00.000Z")

test("isBirthdayMonth matches on the London month only", () => {
  assert.equal(isBirthdayMonth("1990-07-03", JULY), true)
  assert.equal(isBirthdayMonth("1988-07-31", JULY), true)
  assert.equal(isBirthdayMonth("1990-08-03", JULY), false)
  assert.equal(isBirthdayMonth(null, JULY), false)
  assert.equal(isBirthdayMonth("", JULY), false)
})

test("birthdayRewardExpiresAt is the first instant of the next London month (BST)", () => {
  // 1 Aug 2026 00:00 BST (+01:00) === 31 Jul 2026 23:00 UTC.
  assert.equal(
    birthdayRewardExpiresAt(JULY).toISOString(),
    "2026-07-31T23:00:00.000Z"
  )
})

test("birthdayRewardExpiresAt rolls the year over at December (GMT)", () => {
  // 1 Jan 2027 00:00 GMT (+00:00).
  assert.equal(
    birthdayRewardExpiresAt(DECEMBER).toISOString(),
    "2027-01-01T00:00:00.000Z"
  )
})

test("birthdayRewardExpiresAt handles a leap-February with no day overflow", () => {
  // Feb 2028 is a leap month; expiry is 1 Mar 2028 00:00 GMT.
  assert.equal(
    birthdayRewardExpiresAt(new Date("2028-02-29T12:00:00.000Z")).toISOString(),
    "2028-03-01T00:00:00.000Z"
  )
})

test("currentBirthdayYear is the London calendar year", () => {
  assert.equal(currentBirthdayYear(JULY), 2026)
  assert.equal(currentBirthdayYear(DECEMBER), 2026)
})
