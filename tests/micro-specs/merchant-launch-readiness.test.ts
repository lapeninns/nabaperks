import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("05 merchant launch readiness readback", () => {
  it("derives a five-step backend launch checklist with a single next action", async () => {
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
      staffMembers: [
        {
          id: "staff-1",
          displayName: "Maya",
          role: "staff",
          isActive: true,
          createdAt: "2026-06-13T09:00:00.000Z",
        },
      ],
      stations: [
        {
          id: "station-1",
          stationName: "Front till",
          status: "unpaired",
          pairingCode: "123456",
          pairingExpiresAt: "2026-06-13T09:15:00.000Z",
          pairedAt: null,
          lastSeenAt: null,
        },
      ],
    })

    expect(readiness.completed).toBe(3)
    expect(readiness.total).toBe(5)
    expect(readiness.launchReady).toBe(false)
    expect(readiness.nextStep).toMatchObject({
      id: "station",
      actionLabel: "Pair station",
      href: "/app/launch?tab=staff",
    })
    expect(readiness.steps.map((step) => [step.id, step.ready])).toEqual([
      ["card", true],
      ["rewards", true],
      ["staff", true],
      ["station", false],
      ["qr", false],
    ])
  })

  it("threads launch readiness into the merchant dashboard and launch hub", () => {
    const dashboardPage = readProjectFile("app/app/page.tsx")
    const launchPage = readProjectFile("app/app/launch/page.tsx")
    const panel = readProjectFile(
      "components/merchant/launch-readiness-panel.tsx"
    )

    expect(dashboardPage).toContain("getMerchantLaunchReadiness")
    expect(dashboardPage).toContain("LaunchReadinessPanel")
    expect(launchPage).toContain("buildLaunchReadiness")
    expect(panel).toContain("Launch readiness")
    expect(panel).toContain("Ink progress")
    expect(panel).toContain("nextStep")
  })
})
