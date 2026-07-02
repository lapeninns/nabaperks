import assert from "node:assert/strict"
import { test } from "node:test"

import {
  VENUE_ANNOUNCEMENT_DAILY_LIMIT,
  VENUE_ANNOUNCEMENT_DAILY_WINDOW_MS,
  resolveVenueAnnouncementAudienceCustomerIds,
  validateVenueAnnouncementText,
  venueAnnouncementDailyLimitKey,
  venueAnnouncementDedupeKey,
} from "@/lib/notifications/venue-announcement-core"

test("Given messy announcement copy When text is validated Then whitespace is collapsed and length is capped", () => {
  const result = validateVenueAnnouncementText({
    title: "  New \n menu\ttonight  ",
    body: ` ${"A".repeat(220)} `,
  })

  assert.deepEqual(result, {
    ok: true,
    title: "New menu tonight",
    body: "A".repeat(180),
  })
})

test("Given short or non-string announcement copy When text is validated Then it fails closed", () => {
  assert.deepEqual(validateVenueAnnouncementText({ title: "Hi", body: 123 }), {
    ok: false,
    error: "invalid_title",
  })
  assert.deepEqual(
    validateVenueAnnouncementText({ title: "Sunday roast", body: "short" }),
    {
      ok: false,
      error: "invalid_body",
    }
  )
})

test("Given unsafe announcement copy When text is validated Then moderation fails closed", () => {
  const cases = [
    {
      title: "Kitchen note",
      body: "Book tonight at https://example.com/table.",
    },
    {
      title: "Member note",
      body: "Email rewards@example.com to claim your prize.",
    },
    {
      title: "Payment note",
      body: "Verify your card details before the reward expires.",
    },
    {
      title: "Call note",
      body: "Call +44 7700 900123 to claim this reward.",
    },
  ]

  for (const unsafe of cases) {
    assert.deepEqual(validateVenueAnnouncementText(unsafe), {
      ok: false,
      error: "moderation_rejected",
    })
  }
})

test("Given mixed announcement eligibility inputs When audience is resolved Then consent preference and subscription are all required", () => {
  const audience = resolveVenueAnnouncementAudienceCustomerIds({
    memberships: [
      { id: "membership-a", customerId: "customer-a" },
      { id: "membership-b", customerId: "customer-b" },
      { id: "membership-c", customerId: "customer-c" },
      { id: "membership-d", customerId: "customer-d" },
      { id: "membership-d-duplicate", customerId: "customer-d" },
    ],
    preferences: [
      { customer_id: "customer-a", marketing_enabled: true },
      { customer_id: "customer-b", marketing_enabled: false },
      { customer_id: "customer-c", marketing_enabled: true },
      { customer_id: "customer-d", marketing_enabled: true },
    ],
    subscriptions: [
      { customer_id: "customer-a" },
      { customer_id: "customer-b" },
      { customer_id: "customer-d" },
    ],
    consents: [
      { customer_id: "customer-a", consent_status: "opted_in" },
      { customer_id: "customer-b", consent_status: "opted_in" },
      { customer_id: "customer-c", consent_status: "opted_in" },
      { customer_id: "customer-d", consent_status: "opted_out" },
      { customer_id: "customer-d", consent_status: "opted_in" },
    ],
  })

  assert.deepEqual([...audience], ["customer-a"])
})

test("Given an announcement When a dedupe key is built Then it is stable per merchant customer and copy", () => {
  const base = {
    merchantId: "merchant-1",
    customerId: "customer-1",
    title: "Kitchen note",
    body: "Roasts are back this weekend.",
  }

  const first = venueAnnouncementDedupeKey(base)

  assert.equal(venueAnnouncementDedupeKey(base), first)
  assert.match(first, /^venue_announcement:merchant-1:customer-1:[a-f0-9]{16}$/)
  assert.notEqual(
    venueAnnouncementDedupeKey({ ...base, body: "Quiz night is back." }),
    first
  )
  assert.notEqual(
    venueAnnouncementDedupeKey({ ...base, customerId: "customer-2" }),
    first
  )
})

test("Given a merchant business date When a daily limit key is built Then announcements are capped to two per day", () => {
  assert.equal(VENUE_ANNOUNCEMENT_DAILY_LIMIT, 2)
  assert.equal(VENUE_ANNOUNCEMENT_DAILY_WINDOW_MS, 24 * 60 * 60 * 1000)
  assert.equal(
    venueAnnouncementDailyLimitKey({
      merchantId: "merchant-1",
      businessDate: "2026-07-02",
    }),
    "venue-announcement:merchant-1:2026-07-02"
  )
})
