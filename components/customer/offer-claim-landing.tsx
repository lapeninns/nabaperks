import type { ReactNode } from "react"

import Link from "next/link"

import { Eyebrow, MonoTag } from "@/components/brand"
import { OfferPass, formatOfferPassDate } from "@/components/loyalty"
import {
  offerClaimHeadline,
  offerStampWord,
} from "@/components/loyalty/offer-pass-copy"
import { OfferCardPreview } from "./offer-card-preview"
import { OfferVenueLine } from "./offer-flow-shell"
import { cn } from "@/lib/utils"

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
  /** Public page pins the same action/footer; merchant preview stays in its panel. */
  readonly stickyAction?: boolean
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
  stickyAction = false,
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
  const childHeading =
    headingLevel === "h1" ? "h2" : headingLevel === "h2" ? "h3" : "h4"
  const lines = benefitLines({
    stamps,
    percent,
    endsOn,
    // The pass face below prints the venue's own terms; without a pass there is
    // nowhere else for them to go, so they join the promise instead.
    extraTerms: percent ? null : extraTerms,
  })

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-4">
        {venue ? <OfferVenueLine>{venue}</OfferVenueLine> : null}
        <div className="grid gap-2">
          {campaign ? (
            <Eyebrow className="max-w-[30ch] break-words">{campaign}</Eyebrow>
          ) : null}
          <Heading className="max-w-[14ch] text-3xl leading-[1.06] font-extrabold tracking-tight break-words sm:text-4xl">
            {stamps ? (
              <>
                <span className="text-primary">{offerStampWord(stamps)}</span>
                {percent ? (
                  <>
                    {" "}
                    <br />
                    and {percent}% off <br />
                    to start with
                  </>
                ) : (
                  " to start your card"
                )}
              </>
            ) : (
              offerClaimHeadline(stamps, percent)
            )}
          </Heading>
        </div>
        {customerDescription ? (
          <p className="text-base leading-6 break-words whitespace-pre-line">
            {customerDescription}
          </p>
        ) : null}
      </div>

      {lines.length > 0 ? (
        <ul className="grid gap-3 text-sm leading-5">
          {lines.map((line, index) => (
            <li
              key={line}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-3"
            >
              <span aria-hidden="true" className="mono-id pt-0.5 text-cobalt">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 break-words whitespace-pre-line">
                {line}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {stamps && stampsRequired > 0 ? (
        <section className="grid min-w-0 gap-3">
          <div className="border-t-2 border-dashed border-line-strong pt-2">
            <Eyebrow>Your card, once you join</Eyebrow>
          </div>
          <MonoTag tone="leaf">
            {stamps} welcome {stamps === 1 ? "stamp" : "stamps"}
          </MonoTag>
          <OfferCardPreview
            venueName={venue}
            current={stamps}
            total={stampsRequired}
            rewardName={rewardName}
            headingLevel={childHeading}
          />
        </section>
      ) : null}

      {percent ? (
        <section className="grid min-w-0 gap-3">
          <div className="border-t-2 border-dashed border-line-strong pt-2">
            <Eyebrow>The pass you will keep</Eyebrow>
          </div>
          <OfferPass
            venueName={venue ?? "the venue"}
            discountPercent={percent}
            validFrom={startsOn ?? ""}
            validTo={endsOn ?? ""}
            requiresIdCheck={requiresIdCheck}
            extraTerms={extraTerms}
            headingLevel={childHeading}
          />
        </section>
      ) : null}

      <div
        className={cn(
          "grid gap-3",
          stickyAction &&
            "sticky bottom-0 z-10 -mx-5 border-t border-line bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-[374px]:-mx-4 max-[374px]:px-4"
        )}
      >
        {claimAction}
        <p className="text-center text-xs leading-5 text-muted-foreground">
          You will verify your mobile number and accept the loyalty terms before
          anything is added.{" "}
          <Link href="/privacy" className="focus-ring font-bold underline">
            Privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  )
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
      `${offerStampWord(stamps)} added to your card the moment you join. There is no app to download.`
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
