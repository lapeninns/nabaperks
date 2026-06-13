import Link from "next/link"

import { StampCodePanel } from "@/components/customer/stamp-code-panel"
import { CustomerShell } from "@/components/layout"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { getCustomerCardState } from "@/lib/customer/card"
import { createStampCode } from "@/lib/customer/stamp-code"

export const dynamic = "force-dynamic"

type StampCodePageProps = {
  params: Promise<{
    membershipId: string
  }>
}

export default async function StampCodePage({ params }: StampCodePageProps) {
  const { membershipId } = await params
  const cardState = await getCustomerCardState(membershipId)

  if (cardState.status !== "ready") {
    return (
      <CodeShell membershipId={membershipId} showBack={false}>
        <StatusBanner title="Card unavailable" tone="error">
          {cardState.status === "unauthenticated"
            ? "Verify your identity from the venue QR to get a stamp code."
            : cardState.status === "unauthorized"
              ? "This card belongs to another customer."
              : "This card could not be found."}
        </StatusBanner>
      </CodeShell>
    )
  }

  if (cardState.unavailableReason) {
    return (
      <CodeShell membershipId={membershipId}>
        <StatusBanner title="Stamps unavailable" tone="warning">
          {cardState.unavailableReason}
        </StatusBanner>
      </CodeShell>
    )
  }

  const result = await createStampCode(membershipId)

  if (result.status === "blocked") {
    return (
      <CodeShell membershipId={membershipId}>
        <StatusBanner title="No code right now" tone="warning">
          {result.reason}
        </StatusBanner>
      </CodeShell>
    )
  }

  return (
    <CodeShell
      membershipId={membershipId}
      venueName={cardState.merchant.business_name}
    >
      <StampCodePanel
        tokenId={result.tokenId}
        code={result.code}
        expiresAt={result.expiresAt}
        kind="stamp"
        doneHref={`/card/${membershipId}?stamp=issued`}
      />
    </CodeShell>
  )
}

function CodeShell({
  children,
  membershipId,
  venueName,
  showBack = true,
}: {
  children: React.ReactNode
  membershipId: string
  venueName?: string
  showBack?: boolean
}) {
  return (
    <CustomerShell>
      <section className="grid gap-5">
        <div className="grid gap-2 text-center">
          <p className="font-mono text-xs uppercase text-muted-foreground">
            Today&apos;s stamp
          </p>
          <h1 className="text-3xl font-extrabold leading-tight text-balance">
            {venueName ?? "Your stamp code"}
          </h1>
        </div>
        {children}
        {showBack ? (
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href={`/card/${membershipId}`}>Back to card</Link>
          </Button>
        ) : null}
      </section>
    </CustomerShell>
  )
}
