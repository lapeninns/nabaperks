import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("02 merchant QR mutation audit events", () => {
  it("includes QR enable and disable mutations in the product event vocabulary", async () => {
    const { productEventNames } = await import("@/lib/analytics/events")

    expect(productEventNames).toContain("qr_enabled")
    expect(productEventNames).toContain("qr_disabled")
  })

  it("renders QR enable and disable as merchant activity rows", async () => {
    const { summarizeActivity } = await import("@/lib/merchant/activity")
    const source = readProjectFile("lib/merchant/activity.ts")

    expect(source).toContain('"qr_enabled"')
    expect(source).toContain('"qr_disabled"')
    expect(source).toContain("Venue QR enabled")
    expect(source).toContain("Venue QR disabled")
    expect(
      summarizeActivity([
        {
          id: "event-1",
          eventName: "qr_enabled",
          category: "qr",
          badgeLabel: "QR enabled",
          headline: "Venue QR enabled",
          summary: "Customer scanning is open from the permanent venue QR.",
          timestamp: "2026-06-13T09:00:00.000Z",
          timestampLabel: "13 Jun 2026, 10:00",
          relativeTime: "just now",
          dateGroup: "2026-06-13",
          dateGroupLabel: "Today",
          details: [],
          searchText: "qr enabled",
        },
      ]).qrEvents
    ).toBe(1)
  })

  it("persists product events inside the set_qr_active database mutation", () => {
    const migrations = readProjectFile(
      "supabase/migrations/20260613142000_record_qr_active_product_events.sql"
    )

    expect(migrations).toContain(
      "create or replace function public.set_qr_active"
    )
    expect(migrations).toContain("insert into public.product_events")
    expect(migrations).toContain("'qr_enabled'")
    expect(migrations).toContain("'qr_disabled'")
  })
})
