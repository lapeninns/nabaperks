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

type PublicQrPageProps = {
  params: Promise<{
    qrId: string
  }>
}

export default async function PublicQrPage({ params }: PublicQrPageProps) {
  const { qrId } = await params
  let qrContext: Awaited<ReturnType<typeof resolveQrForJoin>>

  try {
    qrContext = await resolveQrForJoin(qrId, {
      scanRateLimitIdentity: rateLimitIdentityFromHeaders(await headers()),
    })
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

  const membership = await getExistingMembershipForCurrentUser(
    qrContext.merchant.id
  )
  const joinUrl = `/m/${qrContext.merchant.business_slug}/join?qr=${qrContext.qrId}`

  if (membership) {
    redirect(`/card/${membership.id}/stamp?qr=${qrContext.qrId}`)
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
