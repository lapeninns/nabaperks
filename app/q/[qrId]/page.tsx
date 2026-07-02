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
import { Button } from "@/components/ui/button"
import {
  getExistingMembershipForCurrentUser,
  resolveQrForJoin,
} from "@/lib/customer/join"
import {
  RateLimitError,
  rateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA
export const dynamic = "force-dynamic"

type PublicQrPageProps = {
  params: Promise<{
    qrId: string
  }>
}

export default async function PublicQrPage({ params }: PublicQrPageProps) {
  const { qrId } = await params

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
      scanRateLimitIdentity: rateLimitIdentityFromHeaders(await headers()),
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
  const joinUrl = `/m/${qrContext.merchant.business_slug}/join?qr=${encodedQrId}`

  if (membership) {
    redirect(`/card/${membership.id}/stamp?qr=${encodedQrId}`)
  }

  redirect(joinUrl)
}

function UnavailableQr() {
  return (
    <CustomerFlowShell
      eyebrow="QR"
      title="Card unavailable"
      description="Ask the venue team for the current loyalty QR."
      className="content-center"
      screenLabel="Unavailable QR"
    >
      <CustomerReceipt venueName="Nabaperks" eyebrow="QR unavailable">
        <EmptyState
          icon={AlertDiamondIcon}
          title="This loyalty card is unavailable"
          description="Ask a team member for the current loyalty QR."
          headingLevel={1}
          className="w-full"
          actions={
            <div className="grid w-full gap-2">
              <Button asChild size="lg">
                <Link href="/scan">Scan a QR</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/home">Open my cards</Link>
              </Button>
            </div>
          }
        />
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}

function RateLimitedQr() {
  return (
    <CustomerFlowShell
      eyebrow="QR"
      title="One moment"
      description="Too many scans just now. Wait a moment, then scan the venue QR again."
      className="content-center"
      screenLabel="QR busy"
    >
      <CustomerReceipt venueName="Nabaperks" eyebrow="Try again shortly">
        <EmptyState
          icon={AlertDiamondIcon}
          title="Too many scans just now"
          description="Wait a moment, then scan the venue QR again. Your card is safe."
          headingLevel={1}
          className="w-full"
          actions={
            <Button asChild size="lg" variant="secondary">
              <Link href="/home">Open my cards</Link>
            </Button>
          }
        />
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}
