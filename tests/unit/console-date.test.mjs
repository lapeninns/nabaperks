import assert from "node:assert/strict"
import { test } from "node:test"

import { formatConsoleDate } from "@/lib/merchant/console-date"

test("formats the top bar date in London time with fixed abbreviations", () => {
  assert.equal(
    formatConsoleDate(new Date("2026-09-21T12:00:00Z")),
    "Mon 21 Sep"
  )
  // 23:30 UTC on a BST day is already the next day in London.
  assert.equal(
    formatConsoleDate(new Date("2026-09-21T23:30:00Z")),
    "Tue 22 Sep"
  )
  // GMT: no shift.
  assert.equal(
    formatConsoleDate(new Date("2026-12-31T23:30:00Z")),
    "Thu 31 Dec"
  )
})
