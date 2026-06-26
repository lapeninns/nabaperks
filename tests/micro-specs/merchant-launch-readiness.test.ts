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
  it("derives a venue-first launch checklist with a single next action", async () => {
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
        latitude: 51.5,
        longitude: -0.12,
        geofence_radius_meters: 150,
        require_geofence: true,
        geocoded_at: "2026-06-25T09:00:00.000Z",
      },
    })

    expect(readiness.completed).toBe(2)
    expect(readiness.total).toBe(4)
    expect(readiness.launchReady).toBe(false)
    expect(readiness.nextStep).toMatchObject({
      id: "rewards",
      label: "Your rewards",
      actionLabel: "Add rewards",
      href: "/app/launch?tab=rewards",
    })
    expect(readiness.steps.map((step) => [step.id, step.ready])).toEqual([
      ["venue", true],
      ["card", true],
      ["rewards", false],
      ["qr", false],
    ])
    expect(readiness.checklist.map((step) => step.id)).toEqual([
      "venue",
      "card",
      "rewards",
      "qr",
    ])
    expect(readiness.tabs).toEqual({
      card: true,
      rewards: false,
      venue: true,
      qr: false,
    })
  })

  it("keeps billing-required merchants off launch until a card is on file", async () => {
    const { buildLaunchReadiness } =
      await import("@/lib/merchant/launch-readiness")

    const readiness = buildLaunchReadiness({
      activeCard: {
        id: "card-1",
        card_name: "Mystery Visit Card",
        reward_name: "Surprise reward",
        stamps_required: 3,
      },
      activeRewardPoolItemCount: 3,
      billing: {
        requiresBilling: true,
        status: null,
      },
      qrCode: {
        id: "qr-1",
        qr_id: "WHEF",
        destination_type: "join",
        is_active: true,
      },
      location: {
        id: "location-1",
        name: "Main venue",
        address: "1 High Street, London",
        latitude: 51.5,
        longitude: -0.12,
        geofence_radius_meters: 150,
        require_geofence: true,
        geocoded_at: "2026-06-25T09:00:00.000Z",
      },
    })

    expect(readiness.completed).toBe(4)
    expect(readiness.total).toBe(5)
    expect(readiness.launchReady).toBe(false)
    expect(readiness.nextStep).toMatchObject({
      id: "billing",
      label: "Billing",
      actionLabel: "Add a card to activate",
      href: "/app/launch?tab=billing",
    })
    expect(readiness.checklist.map((step) => step.id)).toEqual([
      "venue",
      "card",
      "rewards",
      "qr",
      "billing",
    ])
  })

  it("treats a trialing billing row as card-on-file launch readiness", async () => {
    const { buildLaunchReadiness } =
      await import("@/lib/merchant/launch-readiness")

    const readiness = buildLaunchReadiness({
      activeCard: {
        id: "card-1",
        card_name: "Mystery Visit Card",
        reward_name: "Surprise reward",
        stamps_required: 3,
      },
      activeRewardPoolItemCount: 3,
      billing: {
        requiresBilling: true,
        status: "trialing",
      },
      qrCode: {
        id: "qr-1",
        qr_id: "WHEF",
        destination_type: "join",
        is_active: true,
      },
      location: {
        id: "location-1",
        name: "Main venue",
        address: "1 High Street, London",
        latitude: 51.5,
        longitude: -0.12,
        geofence_radius_meters: 150,
        require_geofence: true,
        geocoded_at: "2026-06-25T09:00:00.000Z",
      },
    })

    expect(readiness.completed).toBe(5)
    expect(readiness.total).toBe(5)
    expect(readiness.launchReady).toBe(true)
    expect(readiness.nextStep).toBeNull()
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
    expect(panel).toContain(
      "Setup is complete. Customers can scan, join, and collect stamps."
    )
    expect(panel).not.toContain("All four setup steps are complete")
    expect(launchPage).toContain("ensureJoinQrProvisioned")
    expect(launchPage).toContain("isLaunchSetupCompleteWithoutQr")
    expect(launchPage).toContain("setup checks and you're live")
    expect(launchPage).not.toContain("Four stamps")
    expect(launchPage).toContain("Add a card to activate")
    expect(launchPage).toContain("getLaunchBillingReadiness")
    expect(panel).toContain("nextStep")
  })

  it("resolves merchant-controlled continue links after a successful setup save", async () => {
    const {
      getLaunchContinueHrefAfterStep,
      isLaunchStepSaveSuccess,
      resolveLaunchContinueHref,
    } = await import("@/lib/merchant/launch-tab-advance")

    const checklist = [
      { id: "venue", tab: "venue", href: "/app/launch?tab=venue" },
      { id: "card", tab: "card", href: "/app/launch?tab=card" },
      { id: "rewards", tab: "rewards", href: "/app/launch?tab=rewards" },
      { id: "qr", tab: "qr", href: "/app/launch?tab=qr" },
      {
        id: "billing",
        tab: "billing",
        href: "/app/launch?tab=billing",
      },
    ]

    expect(isLaunchStepSaveSuccess("card", { saved: "1" })).toBe(true)
    expect(isLaunchStepSaveSuccess("rewards", { saved: "pool" })).toBe(true)
    expect(isLaunchStepSaveSuccess("qr", { created: "1" })).toBe(true)
    expect(isLaunchStepSaveSuccess("qr", { disabled: "1" })).toBe(false)
    expect(getLaunchContinueHrefAfterStep(checklist, "venue")).toBe(
      "/app/launch?tab=card"
    )
    expect(resolveLaunchContinueHref("card", { saved: "1" }, checklist)).toBe(
      "/app/launch?tab=rewards"
    )
    expect(
      resolveLaunchContinueHref("rewards", { saved: "pool" }, checklist, {
        rewardsReady: false,
      })
    ).toBeNull()
    expect(
      resolveLaunchContinueHref("rewards", { saved: "pool" }, checklist, {
        rewardsReady: true,
      })
    ).toBe("/app/launch?tab=qr")
    expect(
      resolveLaunchContinueHref(
        "rewards",
        { saved: "pool" },
        [
          { id: "venue", tab: "venue", href: "/app/launch?tab=venue" },
          { id: "card", tab: "card", href: "/app/launch?tab=card" },
          { id: "rewards", tab: "rewards", href: "/app/launch?tab=rewards" },
          { id: "qr", tab: "qr", href: "/app/launch?tab=qr" },
        ],
        { rewardsReady: true }
      )
    ).toBe("/app/launch?tab=qr")
  })

  it("drives setup as a guided journey with explicit continue controls", () => {
    const launchPage = readProjectFile("app/app/launch/page.tsx")
    const panel = readProjectFile(
      "components/merchant/launch-readiness-panel.tsx"
    )
    const cardPanel = readProjectFile(
      "components/merchant/launch/card-panel.tsx"
    )
    const rewardsPanel = readProjectFile(
      "components/merchant/launch/rewards-panel.tsx"
    )
    const qrPanel = readProjectFile("components/merchant/launch/qr-panel.tsx")
    const venueForm = readProjectFile(
      "components/merchant/launch/venue-location-form.tsx"
    )
    const shell = readProjectFile("components/layout/merchant-app-shell.tsx")
    const layout = readProjectFile("app/app/layout.tsx")

    // One progress model: the hub renders the same spine as the dashboard
    // instead of a second, divergent tab/progress widget.
    expect(launchPage).toContain("LaunchReadinessPanel")
    // The spine renders the setup steps as stamp slots with a leaf progress track.
    expect(panel).toContain("readiness.checklist")
    expect(panel).toContain("ProgressTrack")

    expect(launchPage).not.toContain("LaunchTabAutoAdvance")
    expect(launchPage).toContain("LaunchTransientQueryCleanup")
    expect(launchPage).toContain("resolveLaunchContinueHref")
    expect(cardPanel).toContain("LaunchSaveNextAction")
    expect(rewardsPanel).toContain("activeRewardPoolItemCount")
    expect(rewardsPanel).toContain("of 3 active rewards")
    expect(qrPanel).toContain("ensureJoinQrProvisioned")
    expect(venueForm).toContain('nextLabel="your card"')
    expect(
      `${cardPanel}\n${rewardsPanel}\n${qrPanel}\n${venueForm}`
    ).not.toContain("Moving to")
    expect(launchPage).toContain("activeTab={activeTab}")
    expect(panel).toContain("activeTab")
    expect(panel).toContain("step.href")
    expect(panel).toContain('isActive ? "page"')
    expect(launchPage).toContain("<BillingPanel")
    expect(launchPage).toContain('href="/app/launch?tab=billing"')
    expect(panel).not.toContain('step.tab !== "billing"')
    expect(shell).toContain('variant === "setup"')
    expect(layout).toContain(
      'variant={isMerchantSetupPath(activePath) ? "setup" : "full"}'
    )

    // The standalone collapsing step rail is gone — no second representation of
    // the same four steps stacked below the spine.
    expect(launchPage).not.toContain("LaunchStepRow")
    expect(launchPage).not.toContain("step.summary")
  })
})
