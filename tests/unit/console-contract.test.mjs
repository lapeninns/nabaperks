import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CONSOLE_EVENT_NAMES,
  isConsoleEventName,
  parseConsoleEvent,
} from "@/lib/analytics/console-contract"

// Registration in lib/analytics/events.ts is asserted by
// tests/contracts/console-analytics.test.mjs (that module is server-only).
test("every console event name round-trips through the name guard", () => {
  for (const name of CONSOLE_EVENT_NAMES) {
    assert.equal(isConsoleEventName(name), true, name)
  }
  assert.equal(isConsoleEventName("posthog_raw"), false)
})

test("parseConsoleEvent accepts each event with exactly its contract payload", () => {
  const accepted = [
    {
      name: "console_tab_selected",
      properties: { tab: "activity", from_tab: "counter" },
    },
    {
      name: "console_tab_selected",
      properties: { tab: "more", from_tab: null },
    },
    { name: "counter_qr_presented", properties: { source: "card" } },
    { name: "counter_qr_present_closed", properties: { duration_ms: 4200 } },
    { name: "team_code_revealed", properties: {} },
    { name: "team_code_reset_confirmed" },
    { name: "team_code_reset_cancelled", properties: {} },
    { name: "numbers_range_changed", properties: { range: 7, from_range: 14 } },
    {
      name: "numbers_day_selected",
      properties: { metric: "stamps", method: "stepper" },
    },
    { name: "numbers_metric_opened", properties: { metric: "qr" } },
    {
      name: "activity_group_expanded",
      properties: { category: "qr", count: 4 },
    },
    {
      name: "activity_filter_changed",
      properties: { filter: "all", range: "7d" },
    },
  ]
  for (const input of accepted) {
    const parsed = parseConsoleEvent(input)
    assert.ok(parsed, JSON.stringify(input))
    assert.equal(parsed.name, input.name)
  }
})

test("parseConsoleEvent rejects unknown names, extra keys and out-of-range values", () => {
  const rejected = [
    null,
    "console_tab_selected",
    { name: "not_an_event", properties: {} },
    {
      name: "console_tab_selected",
      properties: { tab: "settings", from_tab: null },
    },
    {
      name: "console_tab_selected",
      properties: { tab: "activity", from_tab: "counter", email: "x" },
    },
    { name: "counter_qr_presented", properties: { source: "button" } },
    { name: "counter_qr_present_closed", properties: { duration_ms: -1 } },
    { name: "team_code_revealed", properties: { code: "123456" } },
    {
      name: "numbers_range_changed",
      properties: { range: 30, from_range: 14 },
    },
    { name: "numbers_day_selected", properties: { metric: "stamps" } },
    { name: "numbers_metric_opened", properties: { metric: "revenue" } },
    {
      name: "activity_group_expanded",
      properties: { category: "qr", count: 1.5 },
    },
    {
      name: "activity_filter_changed",
      properties: { filter: "all", range: "90d" },
    },
  ]
  for (const input of rejected) {
    assert.equal(parseConsoleEvent(input), null, JSON.stringify(input))
  }
})
