import assert from "node:assert/strict"
import { test } from "node:test"

import {
  PHONE_CHANNEL_EVENT_TYPES,
  resolveDeliveryDecision,
} from "@/lib/notifications/channel-plan-core"

const base = {
  eventType: "reward_ready",
  category: "transactional",
  messagingMode: "live",
  merchantMessagingEnabled: true,
  phoneMessagesEnabled: true,
  phoneCategoryEnabled: true,
  preferredPhoneChannel: "whatsapp",
  whatsappUnavailable: false,
  phoneRecipientAvailable: true,
  pushAvailable: true,
  pushCategoryEnabled: true,
  pushMarketingConsent: false,
  phoneMarketingConsent: { whatsapp: false, sms: false },
  fallbackFrom: null,
}

test("transactional messages use WhatsApp first and retain push as the last fallback", () => {
  assert.deepEqual(resolveDeliveryDecision(base), {
    channels: ["whatsapp", "sms", "push"],
    dryRun: false,
  })
})

test("STOP disables both phone service channels while push remains eligible", () => {
  assert.deepEqual(
    resolveDeliveryDecision({ ...base, phoneMessagesEnabled: false }),
    { channels: ["push"], dryRun: false }
  )
})

test("transactional and reminder toggles govern service phone delivery", () => {
  assert.deepEqual(
    resolveDeliveryDecision({ ...base, phoneCategoryEnabled: false }),
    { channels: ["push"], dryRun: false }
  )
})

test("a WhatsApp fallback retry starts at SMS and preserves the original category", () => {
  assert.deepEqual(
    resolveDeliveryDecision({ ...base, fallbackFrom: "whatsapp" }),
    { channels: ["sms", "push"], dryRun: false }
  )
})

test("marketing phone delivery needs per-channel venue consent while push keeps its own toggle and consent", () => {
  const marketing = {
    ...base,
    eventType: "venue_announcement",
    category: "marketing",
    phoneMarketingConsent: { whatsapp: true, sms: false },
  }
  assert.deepEqual(resolveDeliveryDecision(marketing), {
    channels: ["whatsapp"],
    dryRun: false,
  })
  assert.deepEqual(
    resolveDeliveryDecision({
      ...marketing,
      pushMarketingConsent: true,
      pushCategoryEnabled: true,
    }),
    { channels: ["whatsapp", "push"], dryRun: false }
  )
})

test("off is the safe default and dry-run plans phone rows without provider delivery", () => {
  assert.deepEqual(resolveDeliveryDecision({ ...base, messagingMode: "off" }), {
    channels: ["push"],
    dryRun: false,
  })
  assert.deepEqual(
    resolveDeliveryDecision({ ...base, messagingMode: "dry_run" }),
    { channels: ["whatsapp", "sms", "push"], dryRun: true }
  )
})

test("operational and excluded event types never enter phone delivery", () => {
  assert.deepEqual(
    resolveDeliveryDecision({
      ...base,
      eventType: "push_subscription_failed",
      category: "operational",
    }),
    { channels: ["push"], dryRun: false }
  )
  assert.equal(PHONE_CHANNEL_EVENT_TYPES.has("next_stamp_available"), false)
  assert.equal(PHONE_CHANNEL_EVENT_TYPES.has("dormant_progress"), false)
})

test("a customer-selected SMS preference does not attempt WhatsApp", () => {
  assert.deepEqual(
    resolveDeliveryDecision({ ...base, preferredPhoneChannel: "sms" }),
    { channels: ["sms", "push"], dryRun: false }
  )
})
