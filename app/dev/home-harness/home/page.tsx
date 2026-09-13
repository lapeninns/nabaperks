import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { HomeBirthdayPrompt } from "@/components/customer/home-birthday-prompt"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { HomeSummaryStrip } from "@/components/customer/home-summary-strip"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { buildHomeSummary } from "@/lib/customer/home-dashboard"
import type { HomeCard } from "@/lib/customer/home-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VENUE_DETAILS_CARD: HomeCard = {
  membershipId: "harness-membership",
  businessName: "Old Crown Girton",
  businessSlug: "old-crown-girton",
  locality: "Girton",
  googleReviewUrl:
    "https://search.google.com/local/writereview?placeid=ChIJr-Lmrdt22EcRpM90SQtZug4",
  cardName: "Mystery Visit Card",
  rewardName: "Mystery reward",
  currentStamps: 2,
  stampsRequired: 3,
  stampDates: ["12 Jul", "19 Jul"],
  stampedToday: false,
  lastVisitAt: "2026-07-19T12:00:00.000Z",
  stampsRemaining: 1,
  unlockedRewards: 0,
  available: true,
}

/**
 * Customer dashboard harness — proves the DOB birthday prompt renders in the
 * real customer shell with no auth/DB, including the venue locality and Google
 * review action. `?dob=set` simulates a member who has already stored a birthday
 * (prompt suppressed); the default shows it.
 */
export default async function HomeHarnessHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ dob?: string; reward?: string; long?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const hasDob = params.dob === "set"

  return (
    <div className="grid gap-6">
      {/* Mirrors the real wallet: title only, no description. */}
      <PageTitle eyebrow="My Nabaperks" title="Your cards" />

      {/* The strip is always on so both summary labels — a card that can still
          take a stamp, and a card with a reward ready — stay screenshot-provable.
          Counts come from the real `buildHomeSummary` over the fixture card, with
          only the reward count switched by `?reward=ready` (the fixture carries no
          issued reward of its own). */}
      <HomeSummaryStrip
        summary={{
          ...buildHomeSummary([VENUE_DETAILS_CARD]),
          redeemableCount: params.reward === "ready" ? 1 : 0,
        }}
      />

      {params.reward === "ready" ? (
        <HomeRedeemBanner
          topRedeemable={{
            rewardId: "harness-reward",
            membershipId: VENUE_DETAILS_CARD.membershipId,
            businessName:
              params.long === "1"
                ? "The extraordinarily long neighbourhood venue name"
                : VENUE_DETAILS_CARD.businessName,
            rewardName:
              params.long === "1"
                ? "AnExtraordinarilyLongUnbrokenRewardNameForLayoutTesting"
                : "A mystery reward",
          }}
        />
      ) : null}
      {hasDob ? null : <HomeBirthdayPrompt />}

      <HomeCardTile card={VENUE_DETAILS_CARD} offerPasses={[]} />
    </div>
  )
}
