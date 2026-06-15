import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("05 merchant launch readiness readback", () => {
  it("derives a four-step self-service launch checklist with a single next action", async () => {
    const { buildLaunchReadiness } =
      await import("@/lib/merchant/launch-readiness")

    const readiness = buildLaunchReadiness({
      activeCard: {
        id: "card-1",
        card_name: "Mystery Visit Card",
        reward_name: "Surprise reward",
        stamps_required: 3,
      },
      activeRewardPoolItemCount: 2,
      qrCode: {
        id: "qr-1",
        qr_id: "WHEF",
        destination_type: "join",
        is_active: false,
      },
      location: {
        id: "location-1",
        name: "Main venue",
        address: "1 High Street, London",
        latitude: null,
        longitude: null,
        geofence_radius_meters: 150,
        require_geofence: true,
        geocoded_at: null,
      },
    })

    expect(readiness.completed).toBe(2)
    expect(readiness.total).toBe(4)
    expect(readiness.launchReady).toBe(false)
    expect(readiness.nextStep).toMatchObject({
      id: "venue",
      actionLabel: "Save venue",
      href: "/app/launch?tab=venue",
    })
    expect(readiness.steps.map((step) => [step.id, step.ready])).toEqual([
      ["card", true],
      ["rewards", true],
      ["venue", false],
      ["qr", false],
    ])
    expect(readiness.tabs).toEqual({ card: true, venue: false, qr: false })
  })

  it("threads launch readiness into the merchant dashboard and launch hub", () => {
    const dashboardPage = readProjectFile("app/app/page.tsx")
    const launchPage = readProjectFile("app/app/launch/page.tsx")
    const panel = readProjectFile(
      "components/merchant/launch-readiness-panel.tsx"
    )

    expect(dashboardPage).toContain("getMerchantLaunchReadiness")
    expect(dashboardPage).toContain("LaunchReadinessPanel")
    expect(dashboardPage).toContain("!launchReadiness.launchReady")
    expect(launchPage).toContain("buildLaunchReadiness")
    expect(panel).toContain("Launch readiness")
    expect(panel).toContain("Ink progress")
    expect(panel).toContain("nextStep")
  })
})
