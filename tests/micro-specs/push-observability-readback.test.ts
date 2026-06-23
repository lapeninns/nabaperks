import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const analyticsSource = readFileSync("lib/analytics/events.ts", "utf8")
const workerSource = readFileSync("lib/notifications/delivery-worker.ts", "utf8")

describe("browser push observability and readback", () => {
  it("registers push product analytics names and scrubs push secrets", () => {
    for (const eventName of [
      "push_notification_enqueued",
      "push_notification_delivered",
      "push_notification_skipped",
      "push_notification_failed",
      "push_subscription_created",
      "push_subscription_disabled",
      "push_subscription_failed",
      "push_delivery_worker_ran",
      "push_venue_announcement_queued",
    ]) {
      expect(analyticsSource).toContain(eventName)
    }

    for (const blockedKey of [
      "endpoint",
      "p256dh",
      "auth",
      "latitude",
      "longitude",
    ]) {
      expect(analyticsSource).toContain(`"${blockedKey}"`)
    }
  })

  it("records delivery worker and delivery status product events", () => {
    expect(workerSource).toContain("recordProductEvent")
    expect(workerSource).toContain("push_delivery_worker_ran")
    expect(workerSource).toContain("push_notification_delivered")
    expect(workerSource).toContain("push_notification_skipped")
    expect(workerSource).toContain("push_notification_failed")
  })

  it("exposes customer-scoped notification readback without push secrets", () => {
    const readbackPath = "lib/notifications/readback.ts"
    const routePath = "app/api/notifications/readback/route.ts"

    expect(existsSync(readbackPath)).toBe(true)
    expect(existsSync(routePath)).toBe(true)

    const readbackSource = readFileSync(readbackPath, "utf8")
    const routeSource = readFileSync(routePath, "utf8")

    expect(readbackSource).toContain("notification_events")
    expect(readbackSource).toContain("notification_deliveries")
    expect(readbackSource).toContain("customer_id")
    expect(readbackSource).not.toMatch(/endpoint|p256dh|auth|token/i)

    expect(routeSource).toContain("getCurrentCustomer")
    expect(routeSource).toContain("getCustomerNotificationReadback")
    expect(routeSource).toContain('runtime = "nodejs"')
    expect(routeSource).toContain('dynamic = "force-dynamic"')
  })
})
