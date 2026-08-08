import type { ReactNode } from "react"

import Link from "next/link"

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { OfferPass, StampGrid, formatOfferPassDate } from "@/components/loyalty"

/**
 * The body of the customer's offer landing page — the screen someone reaches by
 * scanning the poster at the venue.
 *
 * This is the ONLY definition of that screen. `app/offer/[token]` renders it
 * with the values `get_offer_claim_context` returned, and step three of the
 * merchant creator renders it with the draft the merchant is about to publish,
 * so "show the exact customer landing page" is true by construction rather than
 * by transcription. A merchant reviewing their offer reads the customer's own
 * sentences, in the customer's own second person, in the customer's own order.
 *
 * It is presentational only: no data access, no server action, no session. Both
 * callers supply the surrounding chrome and the claim control themselves —
 * the route a real form, the review step a switched-off stand-in — because the
 * one thing the two surfaces must NOT share is the ability to claim.
 *
 * The stamp row is the venue's real card at the moment the welcome stamps land,
 * and the discount face is the real {@link OfferPass} the customer will keep, so
 * neither the preview nor the landing can drift from the pass itself.
 */

export type OfferClaimLandingProps = {
  /** The venue's display name. Null renders the copy without naming it. */
  readonly venueName: string | null
  /** The merchant's own name for the offer, shown above the promise. */
  readonly campaignName: string | null
  /** The merchant's own line about the offer, shown under the promise. */
  readonly customerDescription: string | null
  readonly bonusStampCount: number | null
  readonly discountPercent: number | null
  /** The venue's active card length. 0 hides the stamp row rather than guessing. */
  readonly stampsRequired: number
  /** The reward at the end of that card, when it is known. */
  readonly rewardName: string | null
  readonly requiresIdCheck: boolean
  readonly extraTerms: string | null
  readonly startsOn: string | null
  readonly endsOn: string | null
  /**
   * Outline level for the promise. `h1` is for the landing route, where the
   * offer is the page; `h3` is for the merchant review, which already has one.
   */
  readonly headingLevel?: "h1" | "h2" | "h3"
  /** The claim control, supplied by the surface that is allowed to claim. */
  readonly claimAction?: ReactNode
}

export function OfferClaimLanding({
  venueName,
  campaignName,
  customerDescription,
  bonusStampCount,
  discountPercent,
  stampsRequired,
  rewardName,
  requiresIdCheck,
  extraTerms,
  startsOn,
  endsOn,
  headingLevel = "h1",
  claimAction,
}: OfferClaimLandingProps) {
  const Heading = headingLevel
  const venue = venueName?.trim() || null
  const campaign = campaignName?.trim() || null
  const stamps = bonusStampCount && bonusStampCount > 0 ? bonusStampCount : null
  const percent =
    discountPercent && discountPercent > 0 ? discountPercent : null
  // The pass sits one level under the promise, so the outline never skips a
  // level on the landing route (h1 → h2) or collides on the review step, where
  // the promise is already an h3.
  const passHeading = headingLevel === "h1" ? "h2" : "h3"
  const lines = benefitLines({
    stamps,
    percent,
    endsOn,
    // The pass face below prints the venue's own terms; without a pass there is
    // nowhere else for them to go, so they join the promise instead.
    extraTerms: percent ? null : extraTerms,
  })

  return (
    <div className="grid gap-4">
      {venue ? <MonoTag tone="leaf">{venue}</MonoTag> : null}

      <div className="grid gap-1">
        {campaign ? <Eyebrow>{campaign}</Eyebrow> : null}
        <Heading className="text-xl leading-tight font-extrabold text-balance">
          {offerClaimHeadline(stamps, percent)}
        </Heading>
      </div>

      {/* Merchant-authored copy, rendered as text. */}
      {customerDescription ? (
        <p className="text-sm leading-6 text-foreground">
          {customerDescription}
        </p>
      ) : null}

      {lines.length > 0 ? (
        <ul className="grid gap-1.5 text-sm leading-6 text-muted-foreground">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {stamps && stampsRequired > 0 ? (
        <>
          <hr className="w-rule my-0" />
          <CardProgress
            bonusStampCount={stamps}
            stampsRequired={stampsRequired}
            rewardName={rewardName}
            venueName={venue}
          />
        </>
      ) : null}

      {percent ? (
        <>
          <hr className="w-rule my-0" />
          <section className="grid gap-2">
            <Eyebrow>The pass you will keep</Eyebrow>
            <OfferPass
              venueName={venue ?? "the venue"}
              discountPercent={percent}
              validFrom={startsOn ?? ""}
              validTo={endsOn ?? ""}
              requiresIdCheck={requiresIdCheck}
              extraTerms={extraTerms}
              headingLevel={passHeading}
            />
          </section>
        </>
      ) : null}

      {claimAction}

      <p className="text-xs leading-5 text-muted-foreground">
        You will verify your mobile number and accept the loyalty terms before
        anything is added.{" "}
        <Link href="/privacy" className="underline">
          Privacy notice
        </Link>
        .
      </p>
    </div>
  )
}

/**
 * Column count from the card length, so every length has an intentional shape
 * rather than a ragged tail. The grid always draws `total + 1` slots (the
 * reward chip closes the row), so the table is chosen to divide that evenly
 * where it can: 6 stamps -> 4+3, 8 -> 3+3+3, 10 -> 4+4+3.
 */
function previewColumns(stampsRequired: number): number {
  const slots = Math.max(stampsRequired, 0) + 1
  if (slots <= 6) return slots

  let best = 5
  let bestScore = -Infinity

  for (const columns of [5, 4, 3]) {
    const rows = Math.ceil(slots / columns)
    const lastRow = slots - columns * (rows - 1)
    // Fill the final row as far as possible, then prefer fewer rows. A lonely
    // reward chip on a row of its own is the shape this exists to avoid.
    const score = lastRow * 10 - rows

    if (score > bestScore) {
      bestScore = score
      best = columns
    }
  }

  return best
}

/**
 * The venue's real card with the welcome stamps already on it. `stampsRequired`
 * is the card length the venue actually runs, so a card that cannot be read is
 * not drawn at all rather than drawn at a made-up length.
 */
function CardProgress({
  bonusStampCount,
  stampsRequired,
  rewardName,
  venueName,
}: {
  bonusStampCount: number
  stampsRequired: number
  rewardName: string | null
  venueName: string | null
}) {
  const remaining = Math.max(stampsRequired - bonusStampCount, 0)

  return (
    <section className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Your card, once you join</Eyebrow>
        <MonoTag tone="leaf">
          {bonusStampCount} welcome {bonusStampCount === 1 ? "stamp" : "stamps"}
        </MonoTag>
      </div>
      {/* Columns from the card length, not a hard-coded 5. A 6-stamp card
          (6 + the reward slot = 7) rendered as 5 + 2, leaving three empty
          columns; a 10-stamp card as 5 + 5 + 1, stranding the reward chip alone
          on a third row. This is the first impression of the card mechanic, so
          a ragged grid reads as a bug rather than a designed object
          (CUS 02#66). */}
      <StampGrid
        current={bonusStampCount}
        total={stampsRequired}
        layout="wrap"
        wrapColumns={previewColumns(stampsRequired)}
        compact
        rewardSlot="locked"
        venueName={venueName ?? undefined}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        {remaining === 1
          ? "One more visit and you reach"
          : `${remaining} more visits and you reach`}{" "}
        {rewardName ?? "your reward"}.
      </p>
    </section>
  )
}

/**
 * One sentence naming everything the offer gives, in the order the customer
 * cares about. It is derived from the benefit, never authored, so it cannot
 * promise something the campaign does not carry.
 */
function offerClaimHeadline(
  bonusStampCount: number | null,
  discountPercent: number | null
): string {
  if (bonusStampCount && discountPercent) {
    return `${stampWord(bonusStampCount)} and ${discountPercent}% off to start with`
  }
  if (bonusStampCount) return `${stampWord(bonusStampCount)} to start your card`
  if (discountPercent) return `${discountPercent}% off when you join`
  return "An offer for joining"
}

/**
 * The promise in prose, above the two things it produces.
 *
 * The counter rules — no stacking, photo identification, the venue's own
 * additional terms — are printed once, on the pass face below, because that is
 * the object staff are asked to enforce them against. An offer with no discount
 * has no pass, so its additional terms are listed here instead.
 */
function benefitLines({
  stamps,
  percent,
  endsOn,
  extraTerms,
}: {
  stamps: number | null
  percent: number | null
  endsOn: string | null
  extraTerms: string | null
}): readonly string[] {
  const lines: string[] = []
  const closed = formatOfferPassDate(endsOn)

  if (stamps) {
    lines.push(
      `${stampWord(stamps)} added to your card the moment you join. There is no app to download.`
    )
  }
  if (percent) {
    lines.push(
      `A ${percent}% discount pass you can use as often as you like while the offer runs.`
    )
  }
  if (closed) lines.push(`The offer runs until ${closed}.`)
  if (extraTerms) lines.push(extraTerms)

  return lines
}

function stampWord(count: number): string {
  return count === 1 ? "One bonus stamp" : `${count} bonus stamps`
}
