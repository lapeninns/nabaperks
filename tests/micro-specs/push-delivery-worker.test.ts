import { readFileSync } from "node:fs"

import { describe, expect, it, vi } from "vitest"

import {
  isPermanentWebPushFailure,
  isWithinQuietHours,
  sendWebPushNotification,
} from "@/lib/notifications/delivery-worker"

const workerSource = readFileSync("lib/notifications/delivery-worker.ts", "utf8")
const cronRouteSource = readFileSync(
  "app/api/cron/notifications/route.ts",
  "utf8"
)

describe("browser push delivery worker", () => {
  it("uses VAPID web-push delivery and classifies permanent subscription failures", () => {
    expect(workerSource).toContain("web-push")
    expect(workerSource).toContain("getWebPushServerConfig")
    expect(workerSource).toContain("record_notification_delivery")
    expect(workerSource).toContain("disable_push_subscription_for_customer")
    expect(isPermanentWebPushFailure({ statusCode: 404 })).toBe(true)
    expect(isPermanentWebPushFailure({ statusCode: 410 })).toBe(true)
    expect(isPermanentWebPushFailure({ statusCode: 429 })).toBe(false)
  })

  it("defers reminder and marketing notifications during Europe/London quiet hours", () => {
    expect(
      isWithinQuietHours(new Date("2026-06-22T06:30:00.000Z"), "21:00", "09:00")
    ).toBe(true)
    expect(
      isWithinQuietHours(new Date("2026-06-22T12:30:00.000Z"), "21:00", "09:00")
    ).toBe(false)
    expect(workerSource).not.toContain("T09:00:00+01:00")
  })

  it("produces the scheduled event types without geofencing or raw-location targeting", () => {
    for (const eventType of [
      "next_stamp_available",
      "reward_ready",
      "reward_expiring_soon",
      "reward_expired",
      "dormant_progress",
    ]) {
      expect(workerSource).toContain(eventType)
    }

    expect(workerSource).toContain("expire_due_reward_events")
    expect(workerSource).toContain("notificationRequiresMarketingConsent")
    expect(workerSource).not.toMatch(/geofence|latitude|longitude|coordinates/i)
  })

  it("protects the cron route with CRON_SECRET and node runtime", () => {
    expect(cronRouteSource).toContain('runtime = "nodejs"')
    expect(cronRouteSource).toContain('dynamic = "force-dynamic"')
    expect(cronRouteSource).toContain("CRON_SECRET")
    expect(cronRouteSource).toContain("runPushNotificationDeliveryWorker")
  })

  it("supports a mocked web-push sender for worker tests", async () => {
    const sender = vi.fn(async () => undefined)

    await expect(
      sendWebPushNotification(
        {
          endpoint: "https://push.example.test/subscription",
          keys: {
            p256dh: "browser-push-test-p256dh-key-customer-a",
            auth: "browser-push-test-auth-key-a",
          },
        },
        { title: "Reward ready", body: "Collect soon", url: "/home/rewards" },
        sender
      )
    ).resolves.toEqual({ ok: true, statusCode: 201 })

    expect(sender).toHaveBeenCalledWith(
      {
        endpoint: "https://push.example.test/subscription",
        keys: {
          p256dh: "browser-push-test-p256dh-key-customer-a",
          auth: "browser-push-test-auth-key-a",
        },
      },
      expect.stringContaining("Reward ready")
    )
  })
})
