import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  JOIN_PHONE_BACK_LABEL,
  JOIN_PHONE_CODE_HINT,
} from "@/lib/customer/experience/copy"

function read(path: string) {
  return readFileSync(path, "utf8")
}

describe("customer flow Wet Ink redesign", () => {
  it("routes customer pages through the dedicated Wet Ink flow system", () => {
    const flowSystemPath = "components/customer/customer-flow-system.tsx"

    expect(existsSync(flowSystemPath)).toBe(true)

    const flowSystem = read(flowSystemPath)
    const expectedExports = [
      "CustomerFlowShell",
      "CustomerReceipt",
      "CustomerStampCard",
      "CustomerRewardSeal",
      "CustomerActionNote",
    ]

    for (const exportName of expectedExports) {
      expect(flowSystem).toContain(`function ${exportName}`)
    }

    // The landing route renders Wet Ink chrome directly.
    expect(read("app/m/[merchantSlug]/page.tsx")).toContain(
      "customer-flow-system"
    )

    // The join route is a thin wrapper over the join wizard; the card / stamp /
    // reward routes are thin wrappers over the shared experience layer. Both
    // render the Wet Ink flow system.
    expect(read("app/m/[merchantSlug]/join/page.tsx")).toContain("join-wizard")
    for (const routePath of [
      "app/card/[membershipId]/page.tsx",
      "app/card/[membershipId]/stamp/page.tsx",
      "app/reward/[rewardId]/page.tsx",
    ]) {
      expect(read(routePath), routePath).toContain("customer-card-experience")
    }
    for (const componentPath of [
      "components/customer/customer-card-experience.tsx",
      "components/customer/join-wizard.tsx",
    ]) {
      expect(read(componentPath), componentPath).toContain(
        "customer-flow-system"
      )
    }
  })

  it("uses value-first Wet Ink copy and physical loyalty motifs", () => {
    const flowSystem = read("components/customer/customer-flow-system.tsx")
    const joinPage = read("app/m/[merchantSlug]/join/page.tsx")
    const experience = read("components/customer/customer-card-experience.tsx")
    const copy = read("lib/customer/experience/copy.ts")

    expect(read("DESIGN.md")).toContain("Your first stamp is waiting.")
    expect(copy).toContain("Keep your card on your phone")
    expect(copy).toContain(
      "Accept the terms and your first stamp prints onto the card"
    )
    expect(copy).toContain(JOIN_PHONE_CODE_HINT)
    expect(copy).toContain(JOIN_PHONE_BACK_LABEL)
    expect(read("components/customer/join-forms.tsx")).toContain(
      "JOIN_PHONE_CODE_HINT"
    )
    expect(read("components/customer/join-forms.tsx")).toContain(
      "JOIN_PHONE_BACK_LABEL"
    )
    expect(read("components/customer/join-forms.tsx")).toContain(
      "joinWelcomeHref"
    )
    expect(read("components/customer/join-welcome-step.tsx")).toContain(
      "JOIN_WELCOME_HOW_IT_WORKS"
    )
    expect(read("components/customer/join-welcome-step.tsx")).toContain(
      "StampJourneyPreview"
    )
    expect(joinPage).not.toContain(
      "Join {context.merchant.business_name} Rewards"
    )

    for (const motif of [
      "receipt-edge",
      "w-rule",
      "-rotate-6",
      "CARD Nº",
      "ONE STAMP PER BUSINESS DAY",
    ]) {
      expect(flowSystem, motif).toContain(motif)
    }

    expect(experience).toContain("Something's under there.")
    expect(copy).toContain("Stamp it here")
    expect(experience).toContain("Give it a day to breathe")
  })
})

describe("unified reward ticket system", () => {
  it("collapses the reward into one ticket plus one seal vocabulary", () => {
    expect(existsSync("components/loyalty/reward-ticket.tsx")).toBe(true)
    expect(existsSync("components/loyalty/reward-seal.tsx")).toBe(true)

    const index = read("components/loyalty/index.ts")
    expect(index).toContain("RewardTicket")
    expect(index).toContain("RewardSeal")

    // The stamp-row gift box is retired for the mini ticket chip — one object,
    // three sizes (row chip → ticket → celebration beat).
    const grid = read("components/loyalty/stamp-grid.tsx")
    expect(grid).not.toContain("GiftBox")
    expect(grid).toContain("RewardChip")

    // One seal component at multiple sizes, and ✓ is earned (redeemed) only.
    const seal = read("components/loyalty/reward-seal.tsx")
    for (const size of ['"sm"', '"md"', '"lg"']) {
      expect(seal, size).toContain(size)
    }
    expect(seal).toContain("redeemed")
  })

  it("prints the ticket across sealed, waiting, ready and redeemed states", () => {
    const ticket = read("components/loyalty/reward-ticket.tsx")
    for (const state of ['"sealed"', '"waiting"', '"ready"', '"redeemed"']) {
      expect(ticket, state).toContain(state)
    }
    // Perforated chit, not a flat accent panel.
    expect(ticket).toContain("perforation")
  })

  it("retires the pint-specific hero for the merchant-agnostic ticket", () => {
    const experience = read("components/customer/customer-card-experience.tsx")
    expect(experience).not.toContain("PintReward")
    expect(experience).toContain("RewardTicket")
    expect(experience).toContain("RewardCelebration")
    // Celebration copy is reward-agnostic, never beverage-specific.
    expect(experience).toContain("That's the full card.")
    expect(experience).not.toContain("Pint unlocked")
  })
})

describe("card page information hierarchy", () => {
  it("carries identity once: card name leads, no generic 'Your card' headline", () => {
    const copy = read("lib/customer/experience/copy.ts")
    // The collecting card headline is the card name (or a welcome greeting),
    // never the generic placeholder, and the merchant is no longer repeated in
    // a support line for the steady state.
    expect(copy).not.toContain('"Your card"')
    expect(copy).toContain("Welcome to ${exp.merchantName}")
  })

  it("gives CustomerStampCard a hideHeaderText flag and an afterGrid slot", () => {
    const flowSystem = read("components/customer/customer-flow-system.tsx")
    expect(flowSystem).toContain("hideHeaderText")
    expect(flowSystem).toContain("afterGrid")
    // The slot renders between the grid and the reward ticket.
    const stampCard = flowSystem.slice(
      flowSystem.indexOf("function CustomerStampCard")
    )
    const gridIndex = stampCard.indexOf("<StampGrid")
    const afterGridIndex = stampCard.indexOf("{afterGrid}")
    const ticketIndex = stampCard.indexOf("<RewardTicket")
    expect(gridIndex).toBeGreaterThan(-1)
    expect(afterGridIndex).toBeGreaterThan(gridIndex)
    expect(ticketIndex).toBeGreaterThan(afterGridIndex)
  })

  it("renders card celebrations inside the receipt via afterGrid, not above it", () => {
    const experience = read("components/customer/customer-card-experience.tsx")
    const panel = experience.slice(
      experience.indexOf("function CardProgressPanel")
    )
    const beforeStampCard = panel.slice(0, panel.indexOf("<CustomerStampCard"))
    // Celebrations no longer sit above the stamp card.
    expect(beforeStampCard).not.toContain("RewardCelebration")
    expect(beforeStampCard).not.toContain("StampCelebration")
    // They move into the receipt's afterGrid slot, below the stamp grid.
    expect(panel).toContain("hideHeaderText")
    const afterGrid = panel.slice(panel.indexOf("afterGrid="))
    expect(afterGrid).toContain("RewardCelebration")
    expect(afterGrid).toContain("StampCelebration")
  })
})

describe("join step motivation layers", () => {
  it("keeps step-specific reward motivation after the welcome card", () => {
    const copy = read("lib/customer/experience/copy.ts")
    expect(copy).toContain("joinUnlockingRewardHook")
    expect(copy).toContain("mystery reward")
    expect(copy).toContain("See how stamps and rewards work")

    const joinWizard = read("components/customer/join-wizard.tsx")
    expect(joinWizard).toContain("export function UnlockingReminder")
    expect(joinWizard).toContain("joinUnlockingRewardHook")
    expect(joinWizard).toContain("variant: UnlockingReminderVariant")
    expect(joinWizard).toContain("PhoneUnlockingReminder")
    expect(joinWizard).toContain("TermsFirstStampPreview")
    expect(joinWizard).toContain("RewardSeal")
    expect(joinWizard).toContain("StampGrid")
    expect(joinWizard).not.toContain("StampJourneyPreview")

    expect(read("app/dev/customer-flow/preview/screens.tsx")).toContain(
      "UnlockingReminder"
    )
  })
})
