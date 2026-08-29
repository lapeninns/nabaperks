import Link from "next/link"
import { DiscountTag01Icon, GiftIcon } from "@hugeicons/core-free-icons"

import {
  Eyebrow,
  Icon,
  MonoTag,
  ReceiptCard,
  VenueMark,
} from "@/components/brand"
import { PromiseChip } from "@/components/customer/promise-chip"
import { GoogleReviewButton } from "@/components/customer/google-review-button"
import { ReferralBonusBankMini } from "@/components/customer/referral-bonus-bank-panels"
import { ReferralShareButton } from "@/components/customer/referral-share-button"
import { StampGrid, formatOfferPassDate } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { homeCardStatusCopy } from "@/lib/customer/home-dashboard"
import { rewardSourceBadge } from "@/lib/customer/issued-reward-display"
import { hasVisibleReferralBonusBank } from "@/lib/customer/referral-bonus-bank-copy"
import { formatRewardReadyDate } from "@/lib/customer/uk-calendar"
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
  // The accessible name follows the same branch as the href. A tile pointing at
  // the reward QR was still named "Open your … card": the wrong destination,
  // and a name that did not contain the visible "Open reward QR" label
  // (WCAG 2.5.3 Label in Name, CUS 02#11).
  const ariaLabel = card.stampRewardId
    ? `Open reward QR for your ${card.businessName} card`
    : `Open your ${card.businessName} card`
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
        aria-label={ariaLabel}
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

          {/* No stamp row when there is nothing to draw. The old else-branch
              rendered an empty dashed box — 26px of bordered nothing that read
              as a rendering failure; the status line below carries the state
              (CUS 02#12). */}
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
          ) : null}

          {rewardSlot === "revealed" ? (
            <PromiseChip data-reward-ticket="revealed" kind="reward">
              <Eyebrow>Your reward</Eyebrow>
              {/* Reward name wraps freely on its own row — never truncated or clipped. */}
              <p className="text-sm leading-tight font-extrabold break-words">
                {card.revealedRewardName ?? "Your reward"}
              </p>
              <span className="mono-id w-fit max-w-full rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5">
                {rewardReadyLabel}
              </span>
            </PromiseChip>
          ) : null}

          {/* A paused card kept its status line hidden whenever a reward had
              also been revealed, so the tile showed the reward and never said
              the card could not be used. The status line now always renders
              when the card is unavailable. */}
          {rewardSlot !== "revealed" || !card.available ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {homeCardStatusCopy(card)}
            </p>
          ) : null}

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
        <TilePassChip key={pass.entitlementId} pass={pass} />
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
 * A discount pass shown beside the tile — its own chip, never inside the reward
 * ticket, because a pass has unlimited uses inside its window while a reward is
 * a single collection. It sits outside the tile's own link so that a pass the
 * venue can honour carries the customer straight to its code, whatever the
 * tile itself is pointing at.
 */
function TilePassChip({ pass }: { pass: CustomerOfferPass }) {
  return (
    <PromiseChip data-reward-ticket="offer-pass" kind="pass">
      <div className="flex items-center gap-1.5">
        <Icon icon={DiscountTag01Icon} size={14} />
        <Eyebrow>Discount pass</Eyebrow>
      </div>
      <p className="text-sm leading-tight font-extrabold break-words">
        {pass.discountPercent}% off at {pass.venueName}
      </p>
      <span className="mono-id w-fit max-w-full rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5">
        {tilePassLabel(pass)}
      </span>
      {pass.presentable ? (
        <Button asChild size="sm" variant="reward" className="w-full">
          <Link href={`/pass/${pass.entitlementId}`}>Show pass QR</Link>
        </Button>
      ) : null}
    </PromiseChip>
  )
}

/**
 * The pass's standing in one short line, above the way in to the code. A pass
 * the venue cannot honour keeps this line and offers no code at all.
 */
function tilePassLabel(pass: CustomerOfferPass): string {
  if (pass.presentable) {
    const closes = formatOfferPassDate(pass.validTo)
    return closes ? `Use until · ${closes}` : "Ready to use"
  }
  if (pass.state === "not_started") {
    const opens = formatOfferPassDate(pass.validFrom)
    return opens ? `Opens · ${opens}` : "Opens soon"
  }
  if (pass.state === "revoked") return "No longer active"
  if (pass.state === "expired") return "Finished"
  return "Not available just now"
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
    <PromiseChip data-reward-ticket="gift" kind="gift">
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
    </PromiseChip>
  )
}
