import Link from "next/link"
import { GiftIcon } from "@hugeicons/core-free-icons"

import {
  Eyebrow,
  Icon,
  MonoTag,
  ReceiptCard,
  VenueMark,
} from "@/components/brand"
import { GoogleReviewButton } from "@/components/customer/google-review-button"
import { ReferralBonusBankMini } from "@/components/customer/referral-bonus-bank-panels"
import { ReferralShareButton } from "@/components/customer/referral-share-button"
import { StampGrid } from "@/components/loyalty"
import { homeCardStatusCopy } from "@/lib/customer/home-dashboard"
import { rewardSourceBadge } from "@/lib/customer/issued-reward-display"
import { hasVisibleReferralBonusBank } from "@/lib/customer/referral-bonus-bank-copy"
import { formatRewardReadyDate } from "@/lib/customer/uk-calendar"
import type { HomeCard } from "@/lib/customer/home"
import type { HomeCardGift } from "@/lib/customer/home-types"

export function HomeCardTile({ card }: { card: HomeCard }) {
  const href = card.stampRewardId
    ? `/reward/${card.stampRewardId}`
    : `/card/${card.membershipId}`
  const rewardTag =
    card.stampRewardId !== undefined
      ? { tone: "leaf" as const, label: "Reward ready" }
      : card.unlockedRewards > 0
        ? { tone: "sun" as const, label: "Reward soon" }
        : null
  const rewardSlot = card.stampRewardId
    ? "ready"
    : card.unlockedRewards > 0
      ? "revealed"
      : "locked"
  const rewardReadyLabel = card.revealedRewardRedeemableFrom
    ? `Ready · ${formatRewardReadyDate(card.revealedRewardRedeemableFrom)}`
    : "Back next opening day"

  return (
    <div className="grid gap-2">
      <Link
        href={href}
        className="focus-ring block rounded-[var(--radius)]"
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
            <MonoTag tone={card.stampRewardId ? "leaf" : "plain"}>
              {card.stampRewardId ? "Open reward QR" : "Open card"}
            </MonoTag>
            {rewardTag ? (
              <MonoTag tone={rewardTag.tone}>{rewardTag.label}</MonoTag>
            ) : null}
          </div>

          {card.stampsRequired !== null && card.available ? (
            <StampGrid
              current={card.currentStamps}
              total={card.stampsRequired}
              dates={card.stampDates}
              showEmptySlotNumbers
              rewardSlot={rewardSlot}
              venueName={card.businessName}
              compact
              className="rounded-lg bg-accent p-3"
            />
          ) : (
            <div className="rounded-lg border-2 border-dashed border-ink/20 bg-card p-3" />
          )}

          {rewardSlot === "revealed" ? (
            <div
              data-reward-ticket="revealed"
              className="grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3"
            >
              <Eyebrow>Your reward</Eyebrow>
              {/* Reward name wraps freely on its own row — never truncated or clipped. */}
              <p className="text-sm leading-tight font-extrabold break-words">
                {card.revealedRewardName ?? "Your reward"}
              </p>
              <span className="mono-id w-fit max-w-full rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5">
                {rewardReadyLabel}
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
    ? "Ready to collect"
    : gift.redeemableFrom
      ? `Ready · ${formatRewardReadyDate(gift.redeemableFrom)}`
      : "Back next opening day"

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
