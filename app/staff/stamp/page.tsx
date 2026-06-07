import Link from "next/link"

import { StaffPinForm } from "@/components/staff/staff-pin-form"
import { Eyebrow } from "@/components/brand"
import { StaffShell } from "@/components/layout"
import { ProgressTrack } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { recordProductEvent } from "@/lib/analytics/events"
import { getCustomerCardState } from "@/lib/customer/card"

type StaffStampPageProps = {
  searchParams: Promise<{
    membership?: string
  }>
}

export default async function StaffStampPage({
  searchParams,
}: StaffStampPageProps) {
  const { membership } = await searchParams

  if (!membership) {
    return (
      <StaffShell>
        <StampState
          title="Open from a customer card"
          message="Start a stamp claim from the customer's digital card."
        />
      </StaffShell>
    )
  }

  const cardState = await getCustomerCardState(membership)

  if (cardState.status !== "ready") {
    return (
      <StaffShell>
        <StampState
          title="Card unavailable"
          message={
            cardState.status === "unauthenticated"
              ? "Ask the customer to verify their card from the venue QR first."
              : "This card cannot receive a stamp from this device."
          }
        />
      </StaffShell>
    )
  }

  const loyaltyCard = cardState.loyaltyCard

  if (!loyaltyCard || cardState.unavailableReason) {
    return (
      <StaffShell>
        <StampState
          title="Stamps unavailable"
          message={
            cardState.unavailableReason ??
            "This loyalty card is not active right now."
          }
        />
      </StaffShell>
    )
  }

  const current = Math.min(
    cardState.membership.current_stamp_count,
    loyaltyCard.stamps_required
  )

  await recordProductEvent({
    eventName: "stamp_claim_started",
    merchantId: cardState.merchant.id,
    membershipId: cardState.membership.id,
    actorType: "customer",
    actorId: cardState.membership.id,
  })

  if (current >= loyaltyCard.stamps_required) {
    return (
      <StaffShell>
        <StampState
          title="Reward ready"
          message="This customer has enough stamps for their reward."
          href={
            cardState.latestReward?.status === "unlocked"
              ? `/reward/${cardState.latestReward.id}`
              : `/card/${cardState.membership.id}`
          }
          cta={
            cardState.latestReward?.status === "unlocked"
              ? "Open reward"
              : "Return to card"
          }
        />
      </StaffShell>
    )
  }

  return (
    <StaffShell>
      <section className="grid gap-5 rounded-3xl border bg-card p-6 shadow-xs">
        <div className="grid gap-2 text-center">
          <Eyebrow>Staff approval</Eyebrow>
          <h1 className="text-3xl font-extrabold leading-tight">
            Issue stamp
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {cardState.merchant.business_name}
          </p>
        </div>

        <div className="rounded-3xl bg-accent p-4">
          <ProgressTrack
            current={current}
            total={loyaltyCard.stamps_required}
            label="Customer progress"
          />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {loyaltyCard.card_name}
          </p>
        </div>

        <StaffPinForm membershipId={cardState.membership.id} />
      </section>
    </StaffShell>
  )
}

function StampState({
  title,
  message,
  href,
  cta = "Return to card",
}: {
  title: string
  message: string
  href?: string
  cta?: string
}) {
  return (
    <section className="rounded-3xl border bg-card p-6 text-center shadow-xs">
      <Eyebrow>Stampiee loyalty</Eyebrow>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
      {href ? (
        <Button asChild className="mt-5 w-full">
          <Link href={href}>{cta}</Link>
        </Button>
      ) : null}
    </section>
  )
}
