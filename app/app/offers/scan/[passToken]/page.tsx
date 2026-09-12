import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { OfferFlowShell } from "@/components/customer/offer-flow-shell"
import { OfferPassScanPanel } from "@/components/merchant/offer-pass-scan"
import { StatusBanner } from "@/components/loyalty"
import { OfferPassScanContentSkeleton } from "@/components/merchant/loading-skeletons"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { loadMerchantOfferPassScanContext } from "@/lib/merchant/offer-pass-redemption"
import { merchantLoginHref } from "@/lib/navigation/safe-next-path"
import { offerPassScanBanner } from "@/lib/offers/redeem-core"

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

  return (
    <OfferPassScanPanel
      stickyAction
      context={context}
      venueName={merchant.business_name}
      redeemed={redeemed}
    />
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
        <Link href="/app/scan">Scan another code</Link>
      </Button>
    </>
  )
}

function PassScanShell({ children }: { children: React.ReactNode }) {
  return (
    <OfferFlowShell
      backHref="/app/scan"
      label="At the counter"
      className="pb-28"
    >
      <div className="grid gap-3">
        <p className="mono-id text-cobalt">01 Scanned · 02 Confirm</p>
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Check this pass.
        </h1>
      </div>
      {children}
    </OfferFlowShell>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
