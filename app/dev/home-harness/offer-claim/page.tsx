import { notFound } from "next/navigation"

import { OfferClaimLanding } from "@/components/customer/offer-claim-landing"
import { Button } from "@/components/ui/button"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The offer claim landing (CUS 02#64), which ships at `/offer/[token]` and
 * needs a live campaign token, so nobody has been able to measure it.
 *
 * 02#64 is Critical and its central claim is a number — "measured ~760px before
 * `claimAction`" — that no one can currently check. The finding asks for a
 * conversion decision (cut three of four restatements, hoist and stick the CTA);
 * that decision is the owner's, but it should be made against a real
 * measurement rather than a remembered one.
 *
 * Mounts the REAL component with the fullest plausible campaign — both a bonus
 * stamp count and a discount percent — because that is the case the finding
 * describes, where the member reads the promise four times.
 */
export default function OfferClaimHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="mx-auto grid w-full max-w-customer gap-5 px-4 py-8">
      <OfferClaimLanding
        venueName="Old Crown Girton"
        campaignName="Welcome drink week"
        customerDescription="Join this week and start two stamps ahead."
        bonusStampCount={2}
        discountPercent={20}
        stampsRequired={8}
        rewardName="A free house drink"
        requiresIdCheck={false}
        extraTerms="One pass per member. Not with other offers."
        startsOn="2026-08-01"
        endsOn="2026-08-31"
        headingLevel="h1"
        claimAction={
          <Button type="button" size="lg" className="w-full" data-harness-claim>
            Claim this offer
          </Button>
        }
      />
    </main>
  )
}
