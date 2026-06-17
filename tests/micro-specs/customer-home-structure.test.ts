import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HomeCardTile } from "@/components/customer/home-card-tile"
import type { HomeCard } from "@/lib/customer/home-types"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("customer home dashboard structure", () => {
  it("wires the home page to dashboard components and the richer empty state", () => {
    const homePage = readProjectFile("app/home/(authed)/page.tsx")
    const emptyState = readProjectFile(
      "components/customer/home-empty-state.tsx"
    )

    expect(homePage).toContain("getCustomerHomeDashboard")
    expect(homePage).toContain("HomeSummaryStrip")
    expect(homePage).toContain("HomeActivitySnippet")
    expect(homePage).toContain("HomeRedeemBanner")
    expect(homePage).toContain("HomeCardTile")
    expect(homePage).not.toContain("ProgressTrack")

    expect(readProjectFile("components/customer/home-card-tile.tsx")).toContain(
      "StampGrid"
    )
    expect(emptyState).toContain("JOIN_WELCOME_HOW_IT_WORKS")
    expect(emptyState).toContain('href="/scan"')
    expect(emptyState).toContain("Scan venue QR")
  })

  it("wires scan into the fixed customer navigation", () => {
    const tabBar = readProjectFile("components/layout/customer-tab-bar.tsx")

    expect(tabBar).toContain('href: "/scan"')
    expect(tabBar).toContain('label: "Scan"')
    expect(tabBar).toContain("QrCode01Icon")
    expect(tabBar).toContain('href === "/scan"')
  })

  describe("revealed reward wallet tile", () => {
    const waitingBase = {
      membershipId: "card-1",
      businessName: "Bean & Batch",
      businessSlug: "bean-and-batch",
      cardName: "Visits",
      rewardName: "Coffee",
      currentStamps: 3,
      stampsRequired: 3,
      stampDates: ["11 Jun", "12 Jun", "13 Jun"],
      stampedToday: true,
      lastVisitAt: null,
      stampsRemaining: 0,
      unlockedRewards: 1,
      redeemableRewards: 0,
      available: true,
    } satisfies HomeCard

    function render(card: HomeCard) {
      return renderToStaticMarkup(createElement(HomeCardTile, { card }))
    }

    it("shows a mini ticket naming the won reward and its ready date", () => {
      const html = render({
        ...waitingBase,
        revealedRewardName: "Free coffee",
        revealedRewardRedeemableFrom: "2026-06-18",
      })

      // The stamp row stays complete with its won chip — no mystery "?".
      expect(html).toContain('data-reward-slot="revealed"')
      expect(html).toContain("Reward soon")
      // The mini ticket is the primary revealed signal: it names the reward.
      expect(html).toContain('data-reward-ticket="revealed"')
      expect(html).toContain("Your reward")
      expect(html).toContain("Free coffee")
      expect(html).toContain("Thu 18 Jun")
      // Won, not ready yet → still routes to the card, never the reward QR.
      expect(html).toContain('href="/card/card-1"')
      expect(html).not.toContain("/reward/")
    })

    it("falls back to a generic name and next-opening-day timing", () => {
      const html = render(waitingBase)

      expect(html).toContain('data-reward-ticket="revealed"')
      expect(html).toContain("Your reward")
      expect(html).toContain("Back next opening day")
    })

    it("keeps redeemable rewards on the reward QR route with no mini ticket", () => {
      const html = render({
        ...waitingBase,
        redeemableRewards: 1,
        primaryRewardId: "reward-9",
        revealedRewardName: "Free coffee",
        revealedRewardRedeemableFrom: "2026-06-18",
      })

      expect(html).not.toContain('data-reward-ticket="revealed"')
      expect(html).toContain('href="/reward/reward-9"')
      expect(html).toContain("Reward ready")
    })
  })
})
