import Link from "next/link"
import { GiftIcon } from "@hugeicons/core-free-icons"

import {
  Eyebrow,
  Icon,
  MonoTag,
  ReceiptCard,
  VenueMark,
} from "@/components/brand"
import { OfferPassRail } from "@/components/customer/offer-pass-rail"
import { PolicyCutoverNotice } from "@/components/customer/policy-cutover-notice"
import { GoogleReviewButton } from "@/components/customer/google-review-button"
import { ReferralBonusBankMini } from "@/components/customer/referral-bonus-bank-panels"
import { ReferralShareButton } from "@/components/customer/referral-share-button"
import { StampGrid } from "@/components/loyalty"
import {
  hasReadyStampReward,
  homeCardNextStep,
  homeCardStatusCopy,
  REWARD_NEEDS_SETUP_ACTION,
  stampRewardNeedsSetup,
} from "@/lib/customer/home-dashboard"
import { rewardSourceBadge } from "@/lib/customer/issued-reward-display"
import { hasVisibleReferralBonusBank } from "@/lib/customer/referral-bonus-bank-copy"
import { formatCollectionAvailability } from "@/lib/customer/reward-collection-state"
import type { HomeCard } from "@/lib/customer/home"
import type { HomeCardGift } from "@/lib/customer/home-types"
import type { CustomerOfferPass } from "@/lib/customer/offer-pass"

/**
 * `offerPasses` is passed beside the card rather than hung off `HomeCard`: a
 * discount pass is its own record with unlimited uses inside its window, not a
 * reward the card can complete, and the tile must never let one imply the
 * other.
 *
 * It is deliberately **required** with no default. An optional `= []` compiled
 * silently while no route fed it, which is how the rail shipped as unreachable
 * dead code; a required prop makes forgetting it a type error instead.
 */
export function HomeCardTile({
  card,
  offerPasses,
}: {
  card: HomeCard
  offerPasses: readonly CustomerOfferPass[]
}) {
  const href = card.stampRewardId
    ? `/reward/${card.stampRewardId}`
    : `/card/${card.membershipId}`
  // One chip names what this card can do next — a reward to collect, a reward
  // still waiting, a stamp the venue can add today, or today's stamp already
  // collected — so the tile's next step reads at a glance.
  const nextStep = homeCardNextStep(card)
  const rewardReady = hasReadyStampReward(card)
  // A reward held only by setup is never "ready" and never offers a code.
  const rewardNeedsSetup = stampRewardNeedsSetup(card)
  const rewardTimingLabel = rewardReady
    ? "Ready to collect"
    : rewardNeedsSetup
      ? "Finish setting up to collect"
      : (formatCollectionAvailability(
          card.revealedRewardAvailableFrom ?? null
        ) ?? "Open the card to see when it's ready")
  const openLabel = rewardReady
    ? "Open reward"
    : rewardNeedsSetup
      ? REWARD_NEEDS_SETUP_ACTION
      : "Open card"

  return (
    <div className="grid min-w-0 gap-2">
      {card.policyCutoverNoticeAt ? (
        <PolicyCutoverNotice
          membershipId={card.membershipId}
          issuedAt={card.policyCutoverNoticeAt}
        />
      ) : null}
      <Link
        href={href}
        className="focus-ring block min-w-0 rounded-[var(--radius)]"
        aria-label={`Open your ${card.businessName} card`}
      >
        {/* No hover shadow utilities here: the unlayered card layer pins the
            slotted shadow, so hover:shadow-* is silently defeated (DESIGN.md). */}
        <ReceiptCard className="grid gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid min-w-0 gap-1">
              <Eyebrow>{card.cardName ?? "Loyalty card"}</Eyebrow>
              <h2 className="text-lg leading-tight font-extrabold text-balance break-words">
                {card.businessName}
              </h2>
              {card.locality ? (
                <p className="text-sm text-muted-foreground">{card.locality}</p>
              ) : null}
            </div>
            <VenueMark size={48} name={card.businessName} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MonoTag tone={rewardReady ? "leaf" : "plain"}>{openLabel}</MonoTag>
            {nextStep ? (
              <MonoTag tone={nextStep.tone}>{nextStep.label}</MonoTag>
            ) : null}
          </div>

          {card.stampsRequired !== null && card.available ? (
            <StampGrid
              current={card.currentStamps}
              total={card.stampsRequired}
              dates={card.stampDates}
              showEmptySlotNumbers
              rewardSlot="locked"
              venueName={card.businessName}
              compact
              className="rounded-lg bg-accent p-3"
            />
          ) : (
            <div className="rounded-lg border-2 border-dashed border-ink/20 bg-card p-3" />
          )}

          {card.unlockedRewards > 0 ? (
            <div
              data-reward-ticket="revealed"
              className="grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3"
            >
              <Eyebrow>Your reward</Eyebrow>
              {/* Reward name wraps freely on its own row — never truncated or clipped. */}
              <p className="text-sm leading-tight font-extrabold break-words">
                {card.stampRewardName ??
                  card.revealedRewardName ??
                  "Your reward"}
              </p>
              <span className="mono-id w-fit max-w-full rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5">
                {rewardTimingLabel}
              </span>
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              {homeCardStatusCopy(card)}
            </p>
          )}

          {hasVisibleReferralBonusBank(card.referralBonusBank) ? (
            <ReferralBonusBankMini bank={card.referralBonusBank} />
          ) : null}

          {card.gift ? (
            <TileGiftChip gift={card.gift} businessName={card.businessName} />
          ) : null}
        </ReceiptCard>
      </Link>
      {/* The pass rail sits outside the tile's link on purpose. The tile links
          to the reward, not the card, as soon as a stamp reward is redeemable,
          and so does every other route out of home — so a chip nested in that
          link could carry no link of its own and the customer would see their
          pass with no way to open its code. Out here each chip carries its own
          destination, and no anchor is ever nested inside another. */}
      {offerPasses.map((pass) => (
        <OfferPassRail key={pass.entitlementId} pass={pass} />
      ))}
      {card.referralShareUrl ? (
        <ReferralShareButton
          url={card.referralShareUrl}
          membershipId={card.membershipId}
          venueName={card.businessName}
        />
      ) : null}
      {card.googleReviewUrl ? (
        <GoogleReviewButton
          url={card.googleReviewUrl}
          venueName={card.businessName}
        />
      ) : null}
    </div>
  )
}

/**
 * A birthday / merchant-sent reward shown as a distinct gift on the tile — its
 * own ticket, separate from the stamp card's completion reward, so an incomplete
 * card is never dressed up as complete. The whole tile links to the card (or the
 * earned reward); the gift is collected from the card page it opens.
 */
function TileGiftChip({
  gift,
  businessName,
}: {
  gift: HomeCardGift
  businessName: string
}) {
  const badge = rewardSourceBadge(gift.source, businessName) ?? "Gift"
  const label = gift.redeemable
    ? gift.needsSetup
      ? "Finish setting up to collect"
      : "Ready to collect"
    : (formatCollectionAvailability(gift.availableFrom) ??
      "Open the card to see when it's ready")

  return (
    <div
      data-reward-ticket="gift"
      className="grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3"
    >
      <div className="flex items-center gap-1.5">
        <Icon icon={GiftIcon} size={14} />
        <Eyebrow>{badge}</Eyebrow>
      </div>
      <p className="text-sm leading-tight font-extrabold break-words">
        {gift.rewardName}
      </p>
      <span className="mono-id w-fit max-w-full rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5">
        {label}
      </span>
    </div>
  )
}
