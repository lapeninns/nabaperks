import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { CustomerFlowShell } from "@/components/customer/customer-flow-system"
import { OfferPassQr } from "@/components/customer/offer-pass-qr"
import { CustomerTabBar } from "@/components/layout"
import { OfferPass, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  loadCustomerOfferPass,
  type CustomerOfferPass,
} from "@/lib/customer/offer-pass"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

/**
 * The customer's discount pass, and the only place the pass QR is presented.
 *
 * `/pass/` is deliberately NOT in `PRIVATE_ROUTE_PREFIXES` — listing an
 * unlisted per-customer path in robots.txt advertises it — so the noindex comes
 * from this route's own metadata, exactly as `app/invite/[token]` does.
 *
 * A pass outside its window, or one the venue has withdrawn, renders the same
 * face in a calm recovery state and no code at all. Showing a scannable QR that
 * would be refused at the till is worse than showing none.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Your discount pass · Nabaperks",
  robots: { index: false, follow: false },
}

export default async function CustomerOfferPassPage({
  params,
}: {
  params: Promise<{ entitlementId: string }>
}) {
  const { entitlementId } = await params
  const result = await loadCustomerOfferPass(entitlementId)

  if (result.status === "unauthenticated") {
    redirect(customerLoginHref(`/pass/${entitlementId}`))
  }

  // An unauthorized read is reported as a plain 404: confirming that someone
  // else's pass exists is itself a disclosure.
  if (result.status !== "ready") {
    notFound()
  }

  const { pass } = result

  return (
    <>
      <CustomerFlowShell
        eyebrow="Discount pass"
        title={`${pass.discountPercent}% off at ${pass.venueName}`}
        description={shellSupportLine(pass)}
        className="pb-28"
        screenLabel="Customer discount pass"
      >
        <div className="grid gap-4">
          <OfferPass
            venueName={pass.venueName}
            discountPercent={pass.discountPercent}
            validFrom={pass.validFrom}
            validTo={pass.validTo}
            requiresIdCheck={pass.requiresIdCheck}
            extraTerms={pass.extraTerms}
            state={pass.state}
            headingLevel="h2"
          >
            <PassBody pass={pass} />
          </OfferPass>

          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href={`/card/${pass.membershipId}`}>Back to your card</Link>
          </Button>
        </div>
      </CustomerFlowShell>
      <CustomerTabBar />
    </>
  )
}

/**
 * The code, or the reason there is none. `presentable` already folds together
 * the pass's own state and whether the venue can honour it at all, so a pass
 * that cannot be used never reaches the QR.
 */
function PassBody({ pass }: { pass: CustomerOfferPass }) {
  if (pass.presentable) {
    return (
      <OfferPassQr
        entitlementId={pass.entitlementId}
        venueName={pass.venueName}
        discountPercent={pass.discountPercent}
      />
    )
  }

  if (pass.unavailableReason && pass.state === "active") {
    return (
      <StatusBanner title="Not available just now" tone="warning">
        {pass.unavailableReason} Your pass is safe — it will be here when the
        venue is back.
      </StatusBanner>
    )
  }

  return null
}

function shellSupportLine(pass: CustomerOfferPass): string {
  if (pass.presentable) {
    return "Show the code below at the counter. It refreshes on its own, so there is nothing to keep track of."
  }
  if (pass.state === "not_started") {
    return "Your pass is saved. The code appears the day it opens."
  }
  if (pass.state === "expired" || pass.state === "revoked") {
    return "This pass is no longer in date, so there is no code to show."
  }
  return "There is no code to show at the moment."
}
