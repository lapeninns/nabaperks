import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { OfferPass, StatusBanner } from "@/components/loyalty"
import { MerchantOfferPassRedeemForm } from "@/components/merchant/offer-pass-redeem-form"
import { Button } from "@/components/ui/button"
import type { MerchantOfferPassScanContext } from "@/lib/merchant/offer-pass-redemption"
import { offerPassScanBanner } from "@/lib/offers/redeem-core"

/** Pure counter composition, mounted by the protected route and local QA. */
export function OfferPassScanPanel({
  context,
  venueName,
  redeemed,
  stickyAction = false,
}: {
  context: Extract<MerchantOfferPassScanContext, { entitlementId: string }>
  venueName: string
  redeemed: boolean
  stickyAction?: boolean
}) {
  const banner = offerPassScanBanner(context.status, context.blockedReason)
  const recorded = redeemed && context.status === "redeemed"
  return (
    <>
      <OfferPass
        venueName={venueName}
        discountPercent={context.discountPercent}
        validFrom={context.validFrom ?? ""}
        validTo={context.validTo ?? ""}
        requiresIdCheck={context.requiresIdCheck}
        extraTerms={context.extraTerms}
        headingLevel="h2"
        termsExpanded
        statusTag={
          <MonoTag tone={context.status === "ready" ? "leaf" : "sun"}>
            {recorded ? "Use recorded" : banner.title}
          </MonoTag>
        }
        supportLine={banner.body}
      />
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-y-2 border-dashed border-line-strong py-3 text-sm">
        <dt className="text-muted-foreground">Member</dt>
        <dd className="text-right font-bold break-words">
          {context.customerLabel}
        </dd>
        <dt className="text-muted-foreground">Card</dt>
        <dd className="mono-id text-right">
          {context.membershipId.slice(0, 8)}
        </dd>
      </dl>
      {recorded ? (
        <StatusBanner title="Discount use recorded" tone="success">
          Apply the discount to the eligible items on the till. The member keeps
          their pass for future valid uses.
        </StatusBanner>
      ) : null}
      {context.status === "ready" ? (
        <MerchantOfferPassRedeemForm
          scanToken={context.scanToken}
          discountPercent={context.discountPercent}
          requiresIdCheck={context.requiresIdCheck}
          stickyAction={stickyAction}
        />
      ) : (
        <Button asChild size="lg" className="w-full">
          <Link href="/app/scan">Scan another code</Link>
        </Button>
      )}
      <Button asChild variant="link" size="lg" className="w-full">
        <Link href="/app">Back to dashboard</Link>
      </Button>
    </>
  )
}
