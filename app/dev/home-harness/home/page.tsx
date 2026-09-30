import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { HomeEmailPrompt } from "@/components/customer/home-email-prompt"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { HomeSetupSuggestion } from "@/components/customer/home-setup-suggestion"
import { HomeSummaryStrip } from "@/components/customer/home-summary-strip"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { HomeEmptyState } from "@/components/customer/home-empty-state"
import { buildHomeSummary } from "@/lib/customer/home-dashboard"
import { homeSetupSuggestionCandidates } from "@/lib/customer/home-setup-suggestion"
import type { HomeCard } from "@/lib/customer/home-types"
import { harnessLinkedEmailAction } from "./actions"

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

/** A full card whose reward is unlocked but held by a missing detail. */
const SETUP_REWARD_CARD: HomeCard = {
  ...VENUE_DETAILS_CARD,
  currentStamps: 3,
  stampsRemaining: 0,
  stampDates: ["12 Jul", "19 Jul", "26 Jul"],
  unlockedRewards: 1,
  stampRewardId: "harness-reward",
  stampRewardName: "A mystery reward",
  stampRewardNeedsSetup: true,
}

/** A full card whose reward can be collected now. */
const READY_REWARD_CARD: HomeCard = {
  ...SETUP_REWARD_CARD,
  stampRewardNeedsSetup: false,
}

/** A full card whose reward opens at a concrete server time. */
const WAITING_REWARD_CARD: HomeCard = {
  ...VENUE_DETAILS_CARD,
  currentStamps: 3,
  stampsRemaining: 0,
  stampDates: ["12 Jul", "19 Jul", "26 Jul"],
  unlockedRewards: 1,
  revealedRewardName: "A mystery reward",
  revealedRewardAvailableFrom: "2026-10-01T11:00:00.000Z",
}

type HarnessParams = {
  dob?: string
  reward?: string
  long?: string
  email?: string
  mode?: string
  wallet?: string
}

function harnessCard(reward: string | undefined): HomeCard {
  if (reward === "ready") return READY_REWARD_CARD
  if (reward === "setup") return SETUP_REWARD_CARD
  if (reward === "waiting") return WAITING_REWARD_CARD
  return VENUE_DETAILS_CARD
}

/**
 * Customer home harness: the real home pieces in the customer shell with no
 * auth or database. The single optional suggestion is chosen by the same pure
 * `homeSetupSuggestionCandidates` the real page uses, so each lane below proves
 * the priority order and that two prompts never render together.
 *
 * - `?reward=ready|setup|waiting`: a card whose reward is ready to collect,
 *   unlocked but needing setup ("Get it ready", no suggestion), or waiting
 *   for its concrete opening time. Default: a card still collecting stamps.
 * - `?wallet=email-only`: joined by email, no mobile number (suggests the
 *   mobile number first, then previous stamps once that is set aside).
 *   `email-only-empty` is the same guest with no cards: empty state only.
 *   `link-email` swaps in a display-only action that links on code 424242.
 * - `?email=missing|pending`: no confirmed email (the email suggestion, at the
 *   address or code step). Default and `verified`: a confirmed email.
 *   `&mode=existing|full` switches the email copy to the fallback wording.
 * - `?dob=set`: a stored birthday, so no birthday suggestion.
 * - `?long=1`: overflow fixtures for the banner.
 */
export default async function HomeHarnessHomePage({
  searchParams,
}: {
  searchParams?: Promise<HarnessParams>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params: HarnessParams = searchParams ? await searchParams : {}
  if (params.wallet === "email-only-empty") {
    return (
      <div className="grid gap-6">
        <PageTitle eyebrow="My Nabaperks" title="Your cards" />
        <HomeEmptyState />
      </div>
    )
  }

  const card = harnessCard(params.reward)
  const emailState =
    params.email === "missing" || params.email === "pending"
      ? params.email
      : "verified"
  const emailReason =
    params.mode === "existing" || params.mode === "full"
      ? "wifi_sign_in"
      : "rewards"
  const summary = buildHomeSummary([card])
  const candidates = homeSetupSuggestionCandidates({
    cardCount: 1,
    rewardNeedsSetup: (summary.setupRewardCount ?? 0) > 0,
    hasConfirmedPhone: !params.wallet?.startsWith("email-only"),
    hasConfirmedEmail: emailState === "verified",
    hasBirthday: params.dob === "set",
  })
  const long = params.long === "1"

  return (
    <div className="grid gap-6">
      {/* Mirrors the real home: title only, no description. */}
      <PageTitle eyebrow="My Nabaperks" title="Your cards" />
      <HomeSummaryStrip summary={summary} />
      {card.stampRewardId ? (
        <HomeRedeemBanner
          topRedeemable={{
            rewardId: card.stampRewardId,
            membershipId: card.membershipId,
            needsSetup: card.stampRewardNeedsSetup === true,
            businessName: long
              ? "The extraordinarily long neighbourhood venue name"
              : card.businessName,
            rewardName: long
              ? "AnExtraordinarilyLongUnbrokenRewardNameForLayoutTesting"
              : (card.stampRewardName ?? "A mystery reward"),
          }}
        />
      ) : null}
      <HomeCardTile card={card} offerPasses={[]} />
      {params.wallet === "link-email" ? (
        // Display-only linking action: the real prompt, fed a harness action.
        <HomeEmailPrompt
          action={harnessLinkedEmailAction}
          reason={emailState === "verified" ? null : emailReason}
          initialEmail={emailState === "pending" ? "alex@example.test" : null}
          codePending={emailState === "pending"}
        />
      ) : (
        <HomeSetupSuggestion
          candidates={candidates}
          emailReason={emailReason}
          initialEmail={emailState === "pending" ? "alex@example.test" : null}
          codePending={emailState === "pending"}
        />
      )}
    </div>
  )
}
