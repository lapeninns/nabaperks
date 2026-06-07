import { redirect } from "next/navigation"

import { EmptyState } from "@/components/brand"
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

    throw error
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
    <main className="flex min-h-svh items-center justify-center px-6 py-10">
      <EmptyState
        title="This loyalty card is unavailable"
        description="Ask a team member for the current loyalty QR."
        headingLevel={1}
        className="w-full max-w-sm"
      />
    </main>
  )
}
