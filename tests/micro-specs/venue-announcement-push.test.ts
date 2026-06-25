import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("venue announcement browser push", () => {
  it("keeps announcements on the Web Push notification ledger with strict consent gates", () => {
    const source = readFileSync(
      "lib/notifications/venue-announcements.ts",
      "utf8"
    )

    expect(source).toContain("venue_announcement")
    expect(source).toContain("enqueueNotificationEvent")
    expect(source).toContain("notification_preferences")
    expect(source).toContain("push_subscriptions")
    expect(source).toContain("consent_records")
    expect(source).toContain('.eq("channel", "push")')
    expect(source).toContain("marketing_enabled")
    expect(source).toContain("consent_status")
    expect(source).toContain("opted_in")
    expect(source).not.toMatch(
      /firebase|onesignal|sms|whatsapp|geofence|latitude|longitude|coordinates/i
    )
  })

  it("exposes a merchant-authenticated route with rate limiting", () => {
    const routePath = "app/api/notifications/venue-announcements/route.ts"
    expect(existsSync(routePath)).toBe(true)

    const source = readFileSync(routePath, "utf8")
    expect(source).toContain("getCurrentMerchant")
    expect(source).toContain("enforceRateLimit")
    expect(source).toContain("enqueueVenueAnnouncement")
    expect(source).toContain('runtime = "nodejs"')
    expect(source).toContain('dynamic = "force-dynamic"')
  })

  it("documents that marketing preference alone is not enough", () => {
    const spec = readFileSync(
      "micro-specs/09-notifications/01-browser-push-notification-events.md",
      "utf8"
    )

    expect(spec).toMatch(/venue announcement/i)
    expect(spec).toMatch(/marketing consent/i)
    expect(spec).toMatch(/push preference/i)
  })
})
