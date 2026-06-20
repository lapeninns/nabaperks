import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function readMerchantDashboardSurface() {
  return `${readProjectFile("app/app/page.tsx")}\n${readProjectFile(
    "components/merchant/dashboard-home-streams.tsx"
  )}`
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

    expect(readiness.completed).toBe(1)
    expect(readiness.total).toBe(4)
    expect(readiness.launchReady).toBe(false)
    expect(readiness.nextStep).toMatchObject({
      id: "rewards",
      label: "Your rewards",
      actionLabel: "Add rewards",
      href: "/app/launch?tab=rewards",
    })
    expect(readiness.steps.map((step) => [step.id, step.ready])).toEqual([
      ["card", true],
      ["rewards", false],
      ["venue", false],
      ["qr", false],
    ])
    expect(readiness.tabs).toEqual({
      card: true,
      rewards: false,
      venue: false,
      qr: false,
    })
  })

  it("threads launch readiness into the merchant dashboard and launch hub", () => {
    const dashboardPage = readMerchantDashboardSurface()
    const launchPage = readProjectFile("app/app/launch/page.tsx")
    const panel = readProjectFile(
      "components/merchant/launch-readiness-panel.tsx"
    )

    expect(dashboardPage).toContain("getMerchantLaunchReadiness")
    expect(dashboardPage).toContain("LaunchReadinessPanel")
    expect(dashboardPage).toContain("!launchReadiness.launchReady")
    expect(launchPage).toContain("buildLaunchReadiness")
    expect(launchPage).toContain("RewardsPanel")
    expect(panel).toContain("Launch readiness")
    expect(panel).toContain("Launch setup")
    expect(panel).toContain("Setup progress")
    expect(panel).not.toContain("All four stamps")
    expect(launchPage).toContain("Four setup steps")
    expect(launchPage).not.toContain("Four stamps")
    expect(panel).toContain("nextStep")
  })

  it("drives the launch hub as a tabbed readiness spine, not a duplicated step rail", () => {
    const launchPage = readProjectFile("app/app/launch/page.tsx")
    const panel = readProjectFile(
      "components/merchant/launch-readiness-panel.tsx"
    )

    // One progress model: the hub renders the same spine as the dashboard
    // instead of a second, divergent tab/progress widget.
    expect(launchPage).toContain("LaunchReadinessPanel")
    // The spine renders the four steps as stamp slots with a leaf progress track.
    expect(panel).toContain("readiness.steps")
    expect(panel).toContain("ProgressTrack")

    // The four stamps ARE the tab nav: the hub threads the active tab into the
    // spine, and the spine turns each stamp into a deep link to its tab with the
    // current tab marked as the active page.
    expect(launchPage).toContain("activeTab={activeTab}")
    expect(panel).toContain("activeTab")
    expect(panel).toContain("?tab=")
    expect(panel).toContain('isActive ? "page"')

    // The standalone collapsing step rail is gone — no second representation of
    // the same four steps stacked below the spine.
    expect(launchPage).not.toContain("LaunchStepRow")
    expect(launchPage).not.toContain("step.summary")
  })
})
