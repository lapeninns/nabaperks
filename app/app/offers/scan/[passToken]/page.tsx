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

  // Venue ownership is proved by the loader, from the merchant's own session
  // rather than from the token in the URL. Pausing or ending a campaign stops
  // new claims and, per the specification, deliberately does NOT cancel passes
  // already issued — so a pass in date stays redeemable here.
  const context = await loadMerchantOfferPassScanContext(passToken)

  if (context.status === "unauthenticated") {
    redirect(loginHref)
  }

  if (context.status === "not_found") {
    notFound()
  }

  // A pass minted by another venue. It carries no pass detail at all — that is
  // the point, nothing about another venue's member should reach this screen —
  // so it gets the banner and a way out rather than the pass face, and never a
  // 404, which would leave staff guessing whether the code was even real.
  if (context.status === "unauthorized") {
    return <UnmatchedPassNotice />
  }

  const banner = offerPassScanBanner(context.status, context.blockedReason)

  return (
    <>
      <PassFace context={context} />

      <h2 className="sr-only">Member and card details</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border-2 border-ink bg-card p-4 text-sm">
        <dt className="font-bold text-muted-foreground">Member</dt>
        <dd className="text-right font-bold">{context.customerLabel}</dd>
        <dt className="font-bold text-muted-foreground">Card</dt>
        <dd className="mono-id text-right">
          {context.membershipId.slice(0, 8)}
        </dd>
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

      {/* The twin of the rewards scan exits (03#65). As direct children of
          the shell's `grid gap-4` section both buttons stretched full width and
          stacked, reading as two equal-weight choices; at a busy counter the
          next task is the next member, so "Scan another" leads and the row
          wraps instead. */}
      <div className="flex flex-wrap gap-2">
        {context.status === "redeemed" ? (
          <Button asChild>
            <Link href="/app/scan">Scan another code</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href="/app">Back to dashboard</Link>
        </Button>
      </div>
    </>
  )
}

function UnmatchedPassNotice() {
  const banner = offerPassScanBanner("unauthorized")

  return (
    <>
      <StatusBanner title={banner.title} tone={banner.tone}>
        {banner.body}
      </StatusBanner>
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
      {/* The two facts staff check first, read across a counter as one line. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-extrabold tracking-tight">
          {offerPassDiscountLabel(context.discountPercent)}
        </p>
        {validity ? (
          <p className="text-sm font-bold text-muted-foreground">{validity}</p>
        ) : null}
      </div>
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
