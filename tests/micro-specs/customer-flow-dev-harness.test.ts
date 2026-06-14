import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("customer-flow dev harness", () => {
  it("blocks the dev route in production", async () => {
    const { isCustomerFlowDevHarnessEnabled } =
      await import("@/lib/dev/customer-flow-gate")
    const layoutSource = readFileSync("app/dev/layout.tsx", "utf8")

    expect(isCustomerFlowDevHarnessEnabled("development")).toBe(true)
    expect(isCustomerFlowDevHarnessEnabled("test")).toBe(true)
    expect(isCustomerFlowDevHarnessEnabled("production")).toBe(false)
    expect(layoutSource).toContain("notFound()")
    expect(layoutSource).toContain("isCustomerFlowDevHarnessEnabled")
  })

  it("builds production journey links from the shared demo status shape", async () => {
    const {
      buildCustomerFlowJourneyLinks,
      customerFlowStatusFromRow,
      CUSTOMER_FLOW_DEMO,
    } = await import("@/lib/dev/customer-flow-demo")

    const status = customerFlowStatusFromRow({
      phone: CUSTOMER_FLOW_DEMO.phone,
      row: {
        customer_id: "customer-1",
        membership_id: "membership-1",
        current_stamp_count: 2,
        total_stamps_earned: 2,
        latest_business_date: "2026-06-12",
      },
      latestReward: {
        id: "reward-1",
        status: "unlocked",
        reward_name: "Coffee and cake",
        redeemable_from: "2026-06-15",
      },
    })
    const links = buildCustomerFlowJourneyLinks(status)

    expect(status).toEqual({
      phone: "07467586751",
      merchantSlug: "bean-and-batch",
      qrId: "bean-test-qr",
      customerId: "customer-1",
      membershipId: "membership-1",
      currentStampCount: 2,
      totalStampsEarned: 2,
      latestBusinessDate: "2026-06-12",
      latestReward: {
        id: "reward-1",
        status: "unlocked",
        rewardName: "Coffee and cake",
        redeemableFrom: "2026-06-15",
      },
    })
    expect(links).toEqual({
      joinHero: "/q/bean-test-qr",
      join: "/m/bean-and-batch/join?qr=bean-test-qr",
      qrStampConfirm: "/q/bean-test-qr",
      stampConfirm: "/card/membership-1/stamp?qr=bean-test-qr",
      card: "/card/membership-1",
      reward: "/reward/reward-1",
      redeemedCard: "/card/membership-1?reward=redeemed",
    })
  })

  it("keeps gated links disabled until membership or reward state exists", async () => {
    const { buildCustomerFlowJourneyLinks, customerFlowStatusFromRow } =
      await import("@/lib/dev/customer-flow-demo")

    const links = buildCustomerFlowJourneyLinks(
      customerFlowStatusFromRow({
        phone: "07467586751",
        row: null,
        latestReward: null,
      })
    )

    expect(links).toMatchObject({
      joinHero: "/q/bean-test-qr",
      join: "/m/bean-and-batch/join?qr=bean-test-qr",
      qrStampConfirm: null,
      stampConfirm: null,
      card: null,
      reward: null,
      redeemedCard: null,
    })
  })

  it("models the demo journey as customer playbook cards", async () => {
    const { customerFlowJourneySteps } = await import(
      "@/app/dev/customer-flow/steps"
    )
    const { buildCustomerFlowPreviewLinks } = await import(
      "@/app/dev/customer-flow/preview/screens"
    )
    const steps = customerFlowJourneySteps(buildCustomerFlowPreviewLinks())

    expect(steps).toHaveLength(11)
    expect(steps.map((step) => step.screenLabel)).toEqual([
      "Scan",
      "Join",
      "Stamp",
      "Card",
      "Return",
      "Progress",
      "Unlock",
      "Card",
      "Waiting",
      "Ready",
      "Redeemed",
    ])
    expect(steps[0]).toMatchObject({
      number: "01",
      lane: "Customer",
      label: "First stamp waiting",
      actionHint: "Start from the venue QR.",
      href: "/dev/customer-flow/preview/join-hero",
    })

    for (const step of steps) {
      expect(step.glyph.length).toBeGreaterThan(0)
      expect(step.actionHint.length).toBeGreaterThan(0)
    }

    const playbookCopy = steps
      .map((step) => `${step.label} ${step.detail} ${step.actionHint}`)
      .join(" ")
      .toLowerCase()

    expect(playbookCopy).not.toMatch(/\bstaff\b|\bpin\b|\bcounter\b/)
  })

  it("guards advance commands with membership and stamp-count preconditions", async () => {
    const { assertAdvancePreconditions, customerFlowStatusFromRow } =
      await import("@/lib/dev/customer-flow-demo")
    const missingMembership = customerFlowStatusFromRow({
      phone: "07467586751",
      row: null,
      latestReward: null,
    })
    const memberStatus = customerFlowStatusFromRow({
      phone: "07467586751",
      row: {
        customer_id: "customer-1",
        membership_id: "membership-1",
        current_stamp_count: 1,
        total_stamps_earned: 1,
        latest_business_date: null,
      },
      latestReward: null,
    })

    expect(() => assertAdvancePreconditions(missingMembership, 0, 0)).toThrow(
      "Run the join phase first."
    )
    expect(() => assertAdvancePreconditions(memberStatus, 1, 2)).toThrow(
      "Expected exactly 2 earned stamp rows; found 1."
    )
    expect(() => assertAdvancePreconditions(memberStatus, 1, 1)).not.toThrow()
  })
})
