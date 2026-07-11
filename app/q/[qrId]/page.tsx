import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { UnavailableRecoveryActions } from "@/components/customer/unavailable-recovery"
import { Button } from "@/components/ui/button"
import {
  ASK_TEAM_FOR_QR,
  CARD_UNAVAILABLE_TITLE,
  OPEN_MY_CARDS_LABEL,
} from "@/lib/copy/product-copy"
import {
  getExistingMembershipForCurrentUser,
  resolveQrForJoin,
} from "@/lib/customer/join"
import {
  RateLimitError,
  customerRateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Venue QR",
}
export const dynamic = "force-dynamic"

type PublicQrPageProps = {
  params: Promise<{
    qrId: string
  }>
  searchParams: Promise<{ ref?: string }>
}

export default async function PublicQrPage({
  params,
  searchParams,
}: PublicQrPageProps) {
  const { qrId } = await params
  const { ref } = await searchParams

  // Dev-only boundary probe: lets the DB-free e2e tier render this segment's
  // error boundary (tests/e2e/ux-polish-boundaries.spec.ts) without a
  // database. The NODE_ENV gate keeps it out of production builds, mirroring
  // the app/dev/layout.tsx guard.
  if (process.env.NODE_ENV !== "production" && qrId === "dev-boundary-probe") {
    throw new Error("Customer entry boundary probe")
  }

  let qrContext: Awaited<ReturnType<typeof resolveQrForJoin>>
  let membership: Awaited<
    ReturnType<typeof getExistingMembershipForCurrentUser>
  > = null

  try {
    qrContext = await resolveQrForJoin(qrId, {
      scanRateLimitIdentity: customerRateLimitIdentityFromHeaders(
        await headers()
      ),
    })

    // The membership lookup stays inside the guard: a failed lookup on a
    // valid QR must degrade to the same branded unavailable state as a failed
    // QR resolve, never fall through to the error boundary (CUS-P1-01).
    if (qrContext?.available) {
      membership = await getExistingMembershipForCurrentUser(
        qrContext.merchant.id
      )
    }
  } catch (error) {
    // A rate-limited scan is a transient retry, not a dead QR — give it distinct
    // calm copy so the customer waits and re-scans instead of giving up.
    if (error instanceof RateLimitError) {
      return <RateLimitedQr />
    }

    return <UnavailableQr />
  }

  if (!qrContext || !qrContext.available) {
    return <UnavailableQr />
  }

  const encodedQrId = encodeURIComponent(qrContext.qrId ?? qrId)
  const joinUrl = buildCustomerJoinHref(qrContext.merchant.business_slug, {
    qrId: qrContext.qrId ?? qrId,
    referralCode: ref,
    step: "welcome",
  })

  if (membership) {
    redirect(`/card/${membership.id}/stamp?qr=${encodedQrId}`)
  }

  redirect(joinUrl)
}

/**
 * The error receipts run a single headline (the EmptyState's, inside the
 * receipt) instead of stacking a second level-1 shell headline with
 * near-duplicate copy above it (CUS-P2-02), and hide the mono footer so no
 * placeholder card number reads as fact (CUS-P2-01).
 */
function UnavailableQr() {
  return (
    <CustomerFlowShell
      eyebrow="QR unavailable"
      className="content-center"
      screenLabel="Unavailable QR"
    >
      <CustomerReceipt
        venueName="Nabaperks"
        eyebrow="QR unavailable"
        hideFooter
      >
        <EmptyState
          icon={AlertDiamondIcon}
          title={CARD_UNAVAILABLE_TITLE}
          description={ASK_TEAM_FOR_QR}
          headingLevel={1}
          className="w-full"
          actions={<UnavailableRecoveryActions />}
        />
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}

function RateLimitedQr() {
  return (
    <CustomerFlowShell
      eyebrow="QR busy"
      className="content-center"
      screenLabel="QR busy"
    >
      <CustomerReceipt
        venueName="Nabaperks"
        eyebrow="Try again shortly"
        hideFooter
      >
        <EmptyState
          icon={AlertDiamondIcon}
          title="Too many scans just now"
          description="Wait a moment, then scan the venue QR again. Your card is safe."
          headingLevel={1}
          className="w-full"
          actions={
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
            </Button>
          }
        />
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}
