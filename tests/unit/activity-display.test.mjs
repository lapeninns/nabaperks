import assert from "node:assert/strict"
import { test } from "node:test"

import {
  activityCategory,
  clampActivityLimit,
  customerName,
  dateKeyParts,
  daysBetweenUkDates,
  eventsForCategory,
  formatAssetType,
  formatDateGroupLabel,
  formatDestinationType,
  rewardLabel,
  summarizeActivity,
  toActivityDisplayRow,
  ukDateKey,
} from "@/lib/merchant/activity-display"

// Characterization tests. These PIN the current behaviour of the pure activity
// display core extracted from lib/merchant/activity.ts — a regression guard for
// future refactors, not a spec. If behaviour changes on purpose, update the
// pinned values in the same PR.

const ALL_EVENTS = [
  "qr_scanned",
  "customer_joined",
  "stamp_claim_started",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
  "reward_issued",
  "reward_sent",
  "reward_invite_sent",
  "qr_downloaded",
  "qr_created",
  "qr_enabled",
  "qr_disabled",
  "loyalty_card_created",
  "loyalty_card_updated",
  "merchant_signed_up",
  "subscription_started",
  "subscription_cancelled",
]

test("activityCategory maps every known event and defaults unknowns to account", () => {
  const expected = {
    qr_scanned: "qr",
    customer_joined: "customer",
    stamp_claim_started: "stamp",
    stamp_issued: "stamp",
    reward_unlocked: "reward",
    reward_redeemed: "reward",
    reward_issued: "reward",
    reward_sent: "reward",
    reward_invite_sent: "reward",
    qr_downloaded: "qr",
    qr_created: "qr",
    qr_enabled: "qr",
    qr_disabled: "qr",
    loyalty_card_created: "account",
    loyalty_card_updated: "account",
    merchant_signed_up: "account",
    subscription_started: "account",
    subscription_cancelled: "account",
  }
  for (const [event, category] of Object.entries(expected)) {
    assert.equal(activityCategory(event), category, event)
  }
  assert.equal(activityCategory("totally_unknown_event"), "account")
})

test("eventsForCategory returns the full list for all and the scoped list per category", () => {
  assert.deepEqual(eventsForCategory("all"), ALL_EVENTS)
  assert.deepEqual(eventsForCategory("customer"), ["customer_joined"])
  assert.deepEqual(eventsForCategory("stamp"), [
    "stamp_claim_started",
    "stamp_issued",
  ])
  assert.deepEqual(eventsForCategory("reward"), [
    "reward_unlocked",
    "reward_redeemed",
    "reward_issued",
    "reward_sent",
    "reward_invite_sent",
  ])
  assert.deepEqual(eventsForCategory("qr"), [
    "qr_scanned",
    "qr_downloaded",
    "qr_created",
    "qr_enabled",
    "qr_disabled",
  ])
  assert.deepEqual(eventsForCategory("account"), [
    "loyalty_card_created",
    "loyalty_card_updated",
    "merchant_signed_up",
    "subscription_started",
    "subscription_cancelled",
  ])
})

test("clampActivityLimit floors fractional values and bounds to [1, 250]", () => {
  assert.equal(clampActivityLimit(), 100)
  assert.equal(clampActivityLimit(-5), 1)
  assert.equal(clampActivityLimit(0), 1)
  assert.equal(clampActivityLimit(50), 50)
  assert.equal(clampActivityLimit(10_000), 250)
  assert.equal(clampActivityLimit(12.7), 12)
})

test("small label formatters preserve their current copy", () => {
  assert.equal(rewardLabel("Free Coffee"), "Free Coffee")
  assert.equal(rewardLabel(undefined), "a reward")
  assert.equal(formatDestinationType("join"), "Customer join")
  assert.equal(formatDestinationType("scan_to_stamp"), "scan to stamp")
  assert.equal(formatAssetType("png"), "Png")
  assert.equal(formatAssetType("pdf"), "Pdf")
  assert.equal(customerName("ab***@x.com"), "ab***@x.com")
  assert.equal(customerName(null), "Member")
})

test("UK date helpers are deterministic for a fixed input", () => {
  assert.equal(ukDateKey("2026-07-04T12:00:00.000Z"), "2026-07-04")
  assert.deepEqual(dateKeyParts("2026-07-04"), [2026, 6, 4])
  assert.equal(daysBetweenUkDates("2026-07-01", "2026-07-04"), 3)
  assert.equal(formatDateGroupLabel("2026-07-04T12:00:00.000Z"), "Sat 04 Jul")
})

test("summarizeActivity tallies categories into the summary shape", () => {
  const summary = summarizeActivity([
    { category: "customer" },
    { category: "stamp" },
    { category: "stamp" },
    { category: "reward" },
    { category: "qr" },
    { category: "account" },
  ])
  assert.deepEqual(summary, {
    total: 6,
    joins: 1,
    stamps: 2,
    rewards: 1,
    qrEvents: 1,
    accountEvents: 1,
  })
})

// --- toActivityDisplayRow: pin the deterministic (non-time) projection. The
// relativeTime / timestampLabel / dateGroup fields depend on Date.now() and are
// intentionally excluded here. ---

const baseRow = (over) => ({
  id: "e1",
  event_name: "stamp_issued",
  created_at: "2026-07-04T12:00:00.000Z",
  actor_type: "merchant",
  actor_id: null,
  customer_id: null,
  membership_id: "m1",
  qr_code_id: null,
  metadata: {},
  customers: null,
  customer_memberships: {
    id: "m1",
    current_stamp_count: 3,
    total_stamps_earned: 3,
    total_rewards_redeemed: 0,
  },
  qr_codes: null,
  ...over,
})

const stable = (row) => {
  const r = toActivityDisplayRow(row, new Map(), new Map())
  return {
    eventName: r.eventName,
    category: r.category,
    badgeLabel: r.badgeLabel,
    headline: r.headline,
    summary: r.summary,
    searchText: r.searchText,
    details: r.details,
    primaryAction: r.primaryAction,
    secondaryAction: r.secondaryAction,
  }
}

test("toActivityDisplayRow projects a stamp_issued event", () => {
  assert.deepEqual(stable(baseRow({})), {
    eventName: "stamp_issued",
    category: "stamp",
    badgeLabel: "Stamp collected",
    headline: "Member collected stamp 3",
    summary: "Customer stamp was issued from the venue QR.",
    searchText: "stamp issued",
    details: [
      { label: "Actor", value: "Merchant account" },
      { label: "How", value: "Self-service QR stamp" },
      { label: "Stamps now", value: "3" },
      { label: "Lifetime stamps", value: "3" },
    ],
    primaryAction: { label: "View member", href: "/app/customers?highlight=m1" },
    secondaryAction: { label: "Open QR setup", href: "/app/qr" },
  })
})

test("toActivityDisplayRow projects a customer_joined event", () => {
  assert.deepEqual(stable(baseRow({ id: "e2", event_name: "customer_joined" })), {
    eventName: "customer_joined",
    category: "customer",
    badgeLabel: "Join",
    headline: "Member joined",
    summary: "Joined via venue QR and accepted the loyalty programme.",
    searchText: "customer joined",
    details: [
      { label: "Actor", value: "Merchant account" },
      { label: "How", value: "Scanned venue QR and completed join" },
      { label: "Starting stamps", value: "3" },
    ],
    primaryAction: { label: "View member", href: "/app/customers?highlight=m1" },
    secondaryAction: undefined,
  })
})

test("toActivityDisplayRow projects a reward_redeemed event and threads the reward name into searchText", () => {
  assert.deepEqual(
    stable(
      baseRow({
        id: "e3",
        event_name: "reward_redeemed",
        metadata: { reward_name: "Free Coffee" },
      })
    ),
    {
      eventName: "reward_redeemed",
      category: "reward",
      badgeLabel: "Reward redeemed",
      headline: "Member redeemed Free Coffee",
      summary: "Free Coffee was redeemed by the customer.",
      searchText: "reward redeemed free coffee reward_name free coffee",
      details: [
        { label: "Actor", value: "Merchant account" },
        { label: "How", value: "Customer self-service redemption" },
        { label: "Reward", value: "Free Coffee" },
        { label: "Stamps after redemption", value: "3" },
        { label: "Total redemptions", value: "0" },
      ],
      primaryAction: {
        label: "View member",
        href: "/app/customers?highlight=m1",
      },
      secondaryAction: undefined,
    }
  )
})

test("toActivityDisplayRow projects a qr_scanned event", () => {
  assert.deepEqual(
    stable(baseRow({ id: "e4", event_name: "qr_scanned", actor_type: "customer" })),
    {
      eventName: "qr_scanned",
      category: "qr",
      badgeLabel: "QR scanned",
      headline: "Someone scanned the QR",
      summary: "A customer opened the venue QR resolver.",
      searchText: "qr scanned",
      details: [{ label: "Actor", value: "Member" }],
      primaryAction: {
        label: "View member",
        href: "/app/customers?highlight=m1",
      },
      secondaryAction: undefined,
    }
  )
})
