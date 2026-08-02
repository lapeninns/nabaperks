import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { LaunchFulfilmentStatus } from "@/components/merchant/account/launch-fulfilment-status"
import type { MerchantLaunchFulfilment } from "@/lib/merchant/launch-fulfilment"

export const dynamic = "force-dynamic"

const BASE: MerchantLaunchFulfilment = {
  fulfilmentStatus: "awaiting_dispatch",
  deliveryUnknown: false,
  dispatchedAt: null,
  deliveredAt: null,
  pilotStartsAt: null,
  basePilotEndsAt: null,
  approvedExtensionEnd: null,
  provisionalStripeTrialEnd: "2026-09-12T12:00:00.000Z",
  desiredStripeTrialEnd: null,
  confirmedStripeTrialEnd: "2026-09-12T12:00:00.000Z",
  syncStatus: "awaiting_delivery",
  operationsReviewRequired: false,
}

const DISPATCHED: MerchantLaunchFulfilment = {
  ...BASE,
  fulfilmentStatus: "dispatched",
  dispatchedAt: "2026-08-06T10:30:00.000Z",
}

const DELIVERED: MerchantLaunchFulfilment = {
  ...DISPATCHED,
  fulfilmentStatus: "delivered",
  deliveredAt: "2026-08-09T14:00:00.000Z",
  pilotStartsAt: "2026-08-09T14:00:00.000Z",
  basePilotEndsAt: "2026-09-06T14:00:00.000Z",
  desiredStripeTrialEnd: "2026-09-06T14:00:00.000Z",
  confirmedStripeTrialEnd: "2026-09-06T14:00:00.000Z",
  syncStatus: "synchronised",
}

const REVIEW: MerchantLaunchFulfilment = {
  ...BASE,
  deliveryUnknown: true,
  syncStatus: "review_required",
  operationsReviewRequired: true,
}

const EXPIRED_BY_DATE: MerchantLaunchFulfilment = {
  ...DELIVERED,
  basePilotEndsAt: "2020-02-01T12:00:00.000Z",
  desiredStripeTrialEnd: "2020-02-01T12:00:00.000Z",
  confirmedStripeTrialEnd: "2020-02-01T12:00:00.000Z",
}

export default function TrialHarnessPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ state?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()
  return <TrialHarnessState searchParams={searchParams} />
}

async function TrialHarnessState({
  searchParams,
}: {
  readonly searchParams?: Promise<{ state?: string }>
}) {
  const state = (await searchParams)?.state ?? "delivered"
  const fulfilment =
    state === "awaiting"
      ? BASE
      : state === "dispatched"
        ? DISPATCHED
        : state === "review"
          ? REVIEW
          : state === "expired-by-date"
            ? EXPIRED_BY_DATE
            : DELIVERED
  const billingStatus = state === "expired" ? "active" : "trialing"

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Merchant account"
        title="Billing and launch"
        description="Delivery evidence and the exact platform pilot dates linked to recurring billing."
      />
      <LaunchFulfilmentStatus
        fulfilment={fulfilment}
        billingStatus={billingStatus}
      />
    </div>
  )
}
