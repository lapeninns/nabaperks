import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildPhoneMessageCopy,
  buildPhoneMessageCopyFromPayload,
  buildNotificationPayload,
  notificationEventCategory,
} from "@/lib/notifications/catalog"
import { PHONE_CHANNEL_EVENT_TYPES } from "@/lib/notifications/channel-plan-core"

test("every phone-enabled event has complete SMS and WhatsApp copy", () => {
  for (const eventType of PHONE_CHANNEL_EVENT_TYPES) {
    const copy = buildPhoneMessageCopy({
      eventType,
      businessName: "The Example Inn",
      rewardName: "a house reward",
      announcementTitle: "A venue update",
      announcementBody: "A useful update from the venue for members.",
    })

    assert.ok(copy, `${eventType} has phone copy`)
    assert.ok(copy.smsBody.length > 0 && copy.smsBody.length <= 160)
    assert.ok(copy.whatsappVariables["1"].length > 0)
    if (notificationEventCategory(eventType) === "marketing") {
      assert.match(copy.smsBody, /Reply STOP to opt out\.$/)
    }
  }
})

test("worker phone copy preserves the catalogue SMS and WhatsApp template contract", () => {
  const input = {
    eventType: "venue_announcement",
    businessName: "The Example Inn",
    announcementTitle: "Tonight at the venue",
    announcementBody: "Kitchen service runs until 9pm.",
    url: "/home",
  }
  const payload = buildNotificationPayload(input)
  assert.deepEqual(
    buildPhoneMessageCopyFromPayload(input.eventType, payload),
    buildPhoneMessageCopy(input)
  )
  assert.deepEqual(buildPhoneMessageCopyFromPayload(input.eventType, {}), null)
})

test("reward expiry copy formats the authoritative deadline in London for push and phone", () => {
  const input = {
    eventType: "reward_expiring_soon",
    businessName: "The Example Inn",
    rewardName: "your reward",
    expiresAt: "2026-10-27T15:00:00Z",
  }
  const phone = buildPhoneMessageCopy(input)
  assert.equal(phone.smsBody, "Collect your reward by Tue 27 Oct at 15:00.")
})

test("policy cutover copy states the earning and collection terms", () => {
  const copy = buildNotificationPayload({
    eventType: "loyalty_terms_updated",
    businessName: "The Example Inn",
  })
  assert.equal(
    copy.body,
    "Your card now keeps earning while you hold a reward. Rewards are collectable from the next day; one per visit."
  )
})

test("reward collection copy confirms collection without claiming a new cycle", () => {
  const input = {
    eventType: "reward_collected_cycle_started",
    businessName: "The Example Inn",
    rewardName: "Free starter",
    url: "/card/membership-123",
  }
  const payload = buildNotificationPayload(input)
  const phone = buildPhoneMessageCopy(input)

  assert.equal(payload.title, "Reward collected")
  assert.equal(payload.body, "Free starter collected at The Example Inn.")
  assert.doesNotMatch(payload.body, /new|cycle has started/i)
  assert.equal(phone.smsBody, payload.body)
  assert.deepEqual(phone.whatsappVariables, {
    1: payload.title,
    2: payload.body,
    3: input.url,
  })
})
