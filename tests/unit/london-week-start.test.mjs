import assert from "node:assert/strict"
import { test } from "node:test"

import { londonWeekStart } from "@/lib/notifications/london-time"

test("London week starts on Monday across a BST boundary", () => {
  assert.equal(
    londonWeekStart(new Date("2026-07-23T23:30:00.000Z")),
    "2026-07-20"
  )
  assert.equal(
    londonWeekStart(new Date("2026-10-26T00:30:00.000Z")),
    "2026-10-26"
  )
})
