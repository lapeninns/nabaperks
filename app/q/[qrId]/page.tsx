import { redirect } from "next/navigation"

import { EmptyState, ReceiptCard } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import {
  getExistingMembershipForCurrentUser,
  resolveQrForJoin,
} from "@/lib/customer/join"
import { RateLimitError } from "@/lib/security/rate-limit"

type PublicQrPageProps = {
  params: Promise<{
    qrId: string
  }>
}

export default async function PublicQrPage({ params }: PublicQrPageProps) {
  const { qrId } = await params
  let qrContext: Awaited<ReturnType<typeof resolveQrForJoin>>

  try {
    qrContext = await resolveQrForJoin(qrId)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return <UnavailableQr />
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
    redirect(`/card/${membership.id}`)
  }

  redirect(joinUrl)
}

function UnavailableQr() {
  return (
    <CustomerShell className="grid content-center">
      <ReceiptCard edge className="grid gap-4 text-center">
        <EmptyState
          title="This loyalty card is unavailable"
          description="Ask a team member for the current loyalty QR."
          headingLevel={1}
          className="w-full"
        />
      </ReceiptCard>
    </CustomerShell>
  )
}
