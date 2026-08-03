import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty"
import { OfferPassScanContentSkeleton } from "@/components/merchant/loading-skeletons"
import { MerchantOfferPassRedeemForm } from "@/components/merchant/offer-pass-redeem-form"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  loadMerchantOfferPassScanContext,
  type MerchantOfferPassScanContext,
} from "@/lib/merchant/offer-pass-redemption"
import { merchantLoginHref } from "@/lib/navigation/safe-next-path"
import {
  offerPassDiscountLabel,
  offerPassScanBanner,
  offerPassValidityLabel,
} from "@/lib/offers/redeem-core"

import { loadOfferDeskContext } from "../../actions"

export const dynamic = "force-dynamic"

// Pass scan tokens are uuid-typed in the RPC; reject a malformed one before the
// round trip. One of five copies — see lib/merchant/reward-scanner.ts.
const PASS_SCAN_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type MerchantOfferPassScanPageProps = {
  params: Promise<{
    passToken: string
  }>
  searchParams?: Promise<{
    redeemed?: string | string[]
  }>
}

/**
 * Staff deep link for a scanned discount pass. Read-only: loading this page
 * checks and displays, it never redeems. A member of staff redeems by posting
 * the confirm form below, which is the only mutation entry point in the flow.
 */
export default async function MerchantOfferPassScanPage({
  params,
  searchParams,
}: MerchantOfferPassScanPageProps) {
  const { passToken } = await params

  if (!PASS_SCAN_TOKEN_PATTERN.test(passToken)) {
    notFound()
  }

  const query = searchParams ? await searchParams : {}
  const redeemed = firstParam(query.redeemed) === "1"

  return (
    <PassScanShell>
      <Suspense fallback={<OfferPassScanContentSkeleton />}>
        <PassScanStream passToken={passToken} redeemed={redeemed} />
      </Suspense>
    </PassScanShell>
  )
}

async function PassScanStream({
  passToken,
  redeemed,
}: {
  passToken: string
  redeemed: boolean
}) {
  // Merchant guard first: this deep link is reached from a public /p/<token>
  // handoff, so an anonymous visitor must land on login, not on a pass face.
  // getCurrentMerchant is request-cached, so the loader's own check below costs
  // nothing extra.
  const merchant = await getCurrentMerchant()
  const loginHref = merchantLoginHref(
    `/app/offers/scan/${encodeURIComponent(passToken)}`
  )

  if (!merchant) {
    redirect(loginHref)
  }

  // The offers kill switch covers this surface too, exactly like every other
  // /app/offers/* route. The database RPCs behind it stay ungated on purpose,
  // and the two controls mean different things:
  //   * the feature flag and the per-venue allowlist are a ROLLOUT control.
  //     Turning them off removes the whole surface for a venue; passes already
  //     issued are untouched data and become redeemable again the moment the
  //     venue is switched back on.
  //   * pausing or ending a campaign is the PRODUCT control. It stops new
  //     claims and, per the specification, deliberately does NOT cancel passes
  //     already issued.
  // Gating the RPCs as well would collapse the first into the second and strand
  // customers holding a valid pass.
  const desk = await loadOfferDeskContext()
  if (!desk.enabled) {
    notFound()
  }

  const context = await loadMerchantOfferPassScanContext(passToken)

  if (context.status === "unauthenticated") {
    redirect(loginHref)
  }

  if (context.status === "not_found") {
    notFound()
  }

  const banner = offerPassScanBanner(context.status, context.blockedReason)

  return (
    <>
      <PassFace context={context} />

      <h2 className="sr-only">Member and card details</h2>
      <dl className="grid gap-2 rounded-xl border-2 border-ink bg-card p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-muted-foreground">Member</dt>
          <dd className="text-right font-bold">{context.customerLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-muted-foreground">Card</dt>
          <dd className="mono-id text-right">
            {context.membershipId.slice(0, 8)}
          </dd>
        </div>
      </dl>

      <StatusBanner title={banner.title} tone={banner.tone}>
        {/* Server state is authoritative: ?redeemed=1 only upgrades the copy on
            the fresh post-confirm render, and the status behind it comes from
            the database, so a bookmark or bfcache replay cannot fake it. */}
        {redeemed && context.status === "redeemed"
          ? "Discount applied. "
          : null}
        {banner.body}
      </StatusBanner>

      {context.status === "ready" ? (
        <MerchantOfferPassRedeemForm
          scanToken={context.scanToken}
          discountPercent={context.discountPercent}
          requiresIdCheck={context.requiresIdCheck}
        />
      ) : null}

      {context.status === "redeemed" ? (
        <Button asChild>
          <Link href="/app/scan">Scan another code</Link>
        </Button>
      ) : null}
      <Button asChild variant="secondary">
        <Link href="/app">Back to dashboard</Link>
      </Button>
    </>
  )
}

function PassFace({
  context,
}: {
  context: Extract<MerchantOfferPassScanContext, { entitlementId: string }>
}) {
  const validity = offerPassValidityLabel(context.validTo)

  return (
    <ReceiptCard edge padding="md">
      <Eyebrow>Discount pass</Eyebrow>
      <p className="text-3xl font-extrabold tracking-tight">
        {offerPassDiscountLabel(context.discountPercent)}
      </p>
      {validity ? (
        <p className="text-sm font-bold text-muted-foreground">{validity}</p>
      ) : null}
      {context.extraTerms ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {context.extraTerms}
        </p>
      ) : null}
      <p className="text-sm leading-6 text-muted-foreground">
        {context.requiresIdCheck ? "Photo ID check required. " : null}
        Cannot be used with another reward or offer.
      </p>
    </ReceiptCard>
  )
}

function PassScanShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageTitle
        eyebrow="Discount pass"
        title="Check and redeem discount"
        description="Confirm the member is at the counter, then apply the discount to their bill."
      />
      <section className="grid gap-4">{children}</section>
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
