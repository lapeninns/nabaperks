import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatGroupSummary,
  groupActivityRows,
  isActivityGroup,
  pluralBadge,
} from "@/lib/merchant/activity-grouping"

function row(overrides) {
  return {
    id: overrides.id,
    eventName: overrides.eventName,
    category: overrides.category,
    badgeLabel: overrides.badgeLabel ?? "QR scanned",
    headline: overrides.headline ?? "Someone scanned the QR",
    summary: "",
    timestamp: overrides.timestamp,
    timestampLabel: "",
    relativeTime: overrides.relativeTime ?? "5 min ago",
    dateGroup: overrides.dateGroup ?? "today",
    dateGroupLabel: overrides.dateGroupLabel ?? "Today",
    details: [],
    searchText: "",
    ...(overrides.primaryAction
      ? { primaryAction: overrides.primaryAction }
      : {}),
  }
}

const scan = (id, minutes, dateGroup = "today") =>
  row({
    id,
    eventName: "qr_scanned",
    category: "qr",
    timestamp: `2026-09-21T${String(12 - Math.ceil(minutes / 60)).padStart(2, "0")}:${String(60 - (minutes % 60)).padStart(2, "0")}:00Z`,
    relativeTime: `${minutes} min ago`,
    dateGroup,
    dateGroupLabel: dateGroup === "today" ? "Today" : "Yesterday",
  })

test("four QR scans in one date group collapse into one group in the first row's slot", () => {
  const rows = [
    scan("a", 8),
    row({
      id: "r",
      eventName: "reward_redeemed",
      category: "reward",
      badgeLabel: "Reward redeemed",
      timestamp: "2026-09-21T11:50:00Z",
    }),
    scan("b", 9),
    scan("c", 11),
    scan("d", 12),
  ]
  const entries = groupActivityRows(rows)
  assert.equal(entries.length, 2)
  assert.equal(isActivityGroup(entries[0]), true)
  assert.equal(isActivityGroup(entries[1]), false)
  const group = entries[0]
  assert.equal(group.key, "qr_scanned:today")
  assert.equal(group.count, 4)
  assert.equal(group.headline, "4 QR scans")
  assert.equal(group.summary, "8 to 12 min ago")
  assert.deepEqual(
    group.rows.map((entry) => entry.id),
    ["a", "b", "c", "d"]
  )
})

test("the threshold is three: two scans stay as rows, and it can be tuned", () => {
  const rows = [scan("a", 1), scan("b", 2)]
  assert.equal(
    groupActivityRows(rows).every((entry) => !isActivityGroup(entry)),
    true
  )
  assert.equal(
    isActivityGroup(groupActivityRows(rows, { collapseFrom: 2 })[0]),
    true
  )
})

test("reward rows never collapse, however many there are", () => {
  const rows = Array.from({ length: 5 }, (_, index) =>
    row({
      id: `reward-${index}`,
      eventName: "reward_redeemed",
      category: "reward",
      badgeLabel: "Reward redeemed",
      timestamp: `2026-09-21T10:0${index}:00Z`,
    })
  )
  assert.equal(
    groupActivityRows(rows).every((entry) => !isActivityGroup(entry)),
    true
  )
})

test("date groups never mix: three scans split across days stay separate rows", () => {
  const rows = [scan("a", 5), scan("b", 6), scan("c", 30, "yesterday")]
  assert.equal(
    groupActivityRows(rows).every((entry) => !isActivityGroup(entry)),
    true
  )
  const together = [
    scan("a", 5),
    scan("b", 6),
    scan("c", 7),
    scan("d", 30, "yesterday"),
  ]
  const entries = groupActivityRows(together)
  assert.equal(entries.length, 2)
  assert.equal(isActivityGroup(entries[0]), true)
  assert.equal(entries[1].id, "d")
})

test("joins collapse too, keeping their per-row actions on the rows only", () => {
  const rows = Array.from({ length: 3 }, (_, index) =>
    row({
      id: `join-${index}`,
      eventName: "customer_joined",
      category: "customer",
      badgeLabel: "Join",
      timestamp: `2026-09-21T09:0${index}:00Z`,
      relativeTime: "Yesterday",
      primaryAction: { label: "View member", href: "/app/customers" },
    })
  )
  const [group] = groupActivityRows(rows)
  assert.equal(isActivityGroup(group), true)
  assert.equal(group.headline, "3 joins")
  assert.equal(group.summary, "Yesterday")
  assert.equal("primaryAction" in group, false)
  assert.ok(group.rows.every((entry) => entry.primaryAction))
})

test("summaries and plurals read naturally", () => {
  assert.equal(formatGroupSummary("12 min ago", "8 min ago"), "8 to 12 min ago")
  assert.equal(
    formatGroupSummary("2 hr ago", "Just now"),
    "Just now to 2 hr ago"
  )
  assert.equal(formatGroupSummary("3 days ago", "3 days ago"), "3 days ago")
  assert.equal(pluralBadge("QR scanned"), "QR scans")
  assert.equal(pluralBadge("Join"), "joins")
})
