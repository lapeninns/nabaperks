import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  buildNotificationPayload,
  notificationEventTypes,
  notificationRequiresMarketingConsent,
  notificationEventCategory,
  sanitizeNotificationMetadata,
} from "@/lib/notifications/catalog"

const serverEventsSource = read("lib/notifications/events.ts")
const stampActionSource = read("app/card/[membershipId]/actions.ts")
const rewardCollectionSource = read("lib/merchant/reward-collection.ts")
const notificationLedgerMigration = read(
  "supabase/migrations/20260622140000_notification_ledger_reward_expiry.sql"
)

const expectedEvents = [
  "push_permission_prompt_viewed",
  "push_permission_granted",
  "push_subscription_created",
  "push_subscription_disabled",
  "push_subscription_failed",
  "one_stamp_away",
  "next_stamp_available",
  "reward_unlocked_waiting",
  "reward_ready",
  "profile_required_to_collect",
  "reward_expiring_soon",
  "reward_expired",
  "reward_collected_cycle_started",
  "dormant_progress",
  "venue_announcement",
] as const

describe("browser push notification domain", () => {
  it("defines every planned event with the right consent category", () => {
    expect(notificationEventTypes).toEqual(expectedEvents)
    expect(notificationEventCategory("one_stamp_away")).toBe("transactional")
    expect(notificationEventCategory("next_stamp_available")).toBe("reminder")
    expect(notificationEventCategory("push_subscription_failed")).toBe(
      "operational"
    )
    expect(notificationEventCategory("venue_announcement")).toBe("marketing")
    expect(notificationRequiresMarketingConsent("dormant_progress")).toBe(true)
    expect(notificationRequiresMarketingConsent("venue_announcement")).toBe(
      true
    )
    expect(notificationRequiresMarketingConsent("reward_ready")).toBe(false)
  })

  it("builds safe payloads and strips endpoint, token, phone, email, and raw-location metadata", () => {
    for (const eventType of expectedEvents) {
      const payload = buildNotificationPayload({
        eventType,
        businessName: "Ledger Venue",
        rewardName: "Free coffee",
        announcementTitle: "Tonight only",
        announcementBody: "Kitchen open late.",
        url: "/home/rewards",
      })

      expect(payload.title).toBeTruthy()
      expect(payload.body).toBeTruthy()
      expect(payload.url).toMatch(/^\//)
      expect(JSON.stringify(payload)).not.toMatch(
        /latitude|longitude|endpoint|p256dh|auth/i
      )
    }

    const sanitized = sanitizeNotificationMetadata({
      phone: "07123456789",
      email: "person@example.test",
      endpoint: "https://push.example.test/sub",
      p256dh: "secret",
      auth: "secret",
      token: "secret",
      latitude: 51.5,
      longitude: -0.1,
      safe: "kept",
    })

    expect(sanitized).toEqual({ safe: "kept" })
  })

  it("keeps enqueueing server-side, preference checked, and marketing gated", () => {
    expect(serverEventsSource).toContain("enqueue_notification_event")
    expect(serverEventsSource).toContain("notification_preferences")
    expect(serverEventsSource).toContain("push_subscriptions")
    expect(serverEventsSource).toContain("consent_records")
    expect(serverEventsSource).toContain('.eq("channel", "push")')
    expect(serverEventsSource).toContain("notificationRequiresMarketingConsent")
    expect(serverEventsSource).not.toContain("latitude")
    expect(serverEventsSource).not.toContain("longitude")
  })

  it("hooks only confirmed stamp and merchant collection transitions", () => {
    expect(stampActionSource).toContain("enqueueStampTransitionNotifications")
    expect(stampActionSource).toContain('result.status === "blocked"')
    expect(rewardCollectionSource).toContain("collect_reward_scan_token")
    expect(notificationLedgerMigration).toContain(
      "create or replace function public.collect_reward_scan_token"
    )
    expect(notificationLedgerMigration).toContain(
      "reward_collected_cycle_started"
    )
  })
})

function read(path: string) {
  return readFileSync(path, "utf8")
}
