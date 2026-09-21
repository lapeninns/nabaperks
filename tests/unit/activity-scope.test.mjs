import assert from "node:assert/strict"
import { test } from "node:test"

import {
  activityScopeLabel,
  activityScopeSince,
  parseActivityScope,
} from "@/lib/merchant/activity-scope"

const NOW = new Date("2026-09-21T12:00:00Z")

test("the scope parses to a known value and defaults to 7 days", () => {
  assert.equal(parseActivityScope("today"), "today")
  assert.equal(parseActivityScope("28d"), "28d")
  assert.equal(parseActivityScope("90d"), "7d")
  assert.equal(parseActivityScope(undefined), "7d")
})

test("since is London midnight at the start of the scope", () => {
  assert.equal(activityScopeSince("today", NOW), "2026-09-20T23:00:00.000Z")
  assert.equal(activityScopeSince("7d", NOW), "2026-09-14T23:00:00.000Z")
  assert.equal(activityScopeSince("28d", NOW), "2026-08-24T23:00:00.000Z")
  // GMT: midnight is midnight.
  assert.equal(
    activityScopeSince("today", new Date("2026-12-10T09:00:00Z")),
    "2026-12-10T00:00:00.000Z"
  )
})

test("labels read as a clause", () => {
  assert.equal(activityScopeLabel("today"), "today")
  assert.equal(activityScopeLabel("7d"), "the last 7 days")
})
