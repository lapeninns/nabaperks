import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("customer browser push settings UI", () => {
  const componentSource = () =>
    readFileSync("components/customer/push-notification-settings.tsx", "utf8")

  it("is rendered from the customer profile page and dev preview harness", () => {
    const profilePage = readFileSync(
      "app/home/(authed)/profile/page.tsx",
      "utf8"
    )
    const devPreview = readFileSync(
      "app/dev/customer-notifications/page.tsx",
      "utf8"
    )

    expect(profilePage).toContain("PushNotificationSettings")
    expect(devPreview).toContain("PushNotificationSettings")
  })

  it("models unsupported, denied, granted, and subscribed browser states", () => {
    const source = componentSource()

    for (const expected of [
      "unsupported",
      "installed-required",
      "denied",
      "granted",
      "subscribed",
      "data-notification-state",
    ]) {
      expect(source).toContain(expected)
    }

    expect(source).toContain("Notification.permission")
    expect(source).toContain("serviceWorker.ready")
    expect(source).toContain("PushManager")
    expect(source).toContain("pushManager.getSubscription")
    expect(source).toContain("pushManager.subscribe")
  })

  it("uses only the browser push API routes and keeps marketing separate", () => {
    const source = componentSource()

    for (const route of [
      "/api/notifications/push/public-key",
      "/api/notifications/push/preferences",
      "/api/notifications/push/subscribe",
      "/api/notifications/push/unsubscribe",
    ]) {
      expect(source).toContain(route)
    }

    expect(source).toContain("marketingEnabled")
    expect(source).not.toMatch(/firebase|onesignal|sms|whatsapp|email/i)
    expect(source).not.toMatch(/geofence|latitude|longitude|coordinates/i)
  })
})
