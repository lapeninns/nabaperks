import assert from "node:assert/strict"
import { test } from "node:test"

import { formatCodeRotation } from "@/lib/merchant/team-code-rotation"

const ROTATES_AT = "2026-09-22T04:00:00.000Z" // 05:00 BST

test("names the London rotation hour and the time left in whole units", () => {
  assert.equal(
    formatCodeRotation(ROTATES_AT, new Date("2026-09-21T12:00:00Z")),
    "Changes at 5am, in 16 hours"
  )
  assert.equal(
    formatCodeRotation(ROTATES_AT, new Date("2026-09-22T03:20:00Z")),
    "Changes at 5am, in 40 minutes"
  )
  assert.equal(
    formatCodeRotation(ROTATES_AT, new Date("2026-09-22T03:59:30Z")),
    "Changes at 5am, in under a minute"
  )
  assert.equal(
    formatCodeRotation(ROTATES_AT, new Date("2026-09-22T02:59:00Z")),
    "Changes at 5am, in 1 hour"
  )
})

test("a rotation already passed shows the hour without a countdown", () => {
  assert.equal(
    formatCodeRotation(ROTATES_AT, new Date("2026-09-22T05:00:00Z")),
    "Changes at 5am"
  )
})

test("GMT keeps the 5am label and a bad instant falls back to the daily line", () => {
  assert.equal(
    formatCodeRotation(
      "2026-12-02T05:00:00.000Z",
      new Date("2026-12-01T20:00:00Z")
    ),
    "Changes at 5am, in 9 hours"
  )
  assert.equal(
    formatCodeRotation("not-a-date", new Date("2026-12-01T20:00:00Z")),
    "Changes daily at 5am"
  )
})
