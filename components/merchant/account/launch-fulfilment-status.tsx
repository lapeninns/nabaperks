import { ReceiptCard } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { MerchantLaunchFulfilment } from "@/lib/merchant/launch-fulfilment"
import { hasLaunchPilotEnded } from "@/lib/merchant/launch-pilot-status"

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Europe/London",
})

export function LaunchFulfilmentStatus({
  fulfilment,
  billingStatus,
}: {
  readonly fulfilment: MerchantLaunchFulfilment
  readonly billingStatus: string | null
}) {
  const model = statusModel(fulfilment, billingStatus)
  const trialEndPending =
    fulfilment.syncStatus === "pending" || fulfilment.syncStatus === "retry"
  const deliveryConfirmed = fulfilment.deliveredAt !== null
  const recurringBillingDate = deliveryConfirmed
    ? trialEndPending
      ? (fulfilment.desiredStripeTrialEnd ??
        fulfilment.confirmedStripeTrialEnd ??
        fulfilment.provisionalStripeTrialEnd)
      : (fulfilment.confirmedStripeTrialEnd ??
        fulfilment.desiredStripeTrialEnd ??
        fulfilment.provisionalStripeTrialEnd)
    : null

  return (
    <ReceiptCard edge padding="none">
      <CardHeader className="border-b border-dashed border-line p-5">
        <CardTitle className="font-heading text-xl font-extrabold">
          Posters and platform pilot
        </CardTitle>
        <CardDescription>
          Your 28-day platform pilot begins when your posters are delivered.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-5">
        <StatusBanner tone={model.tone} title={model.title}>
          {model.detail}
        </StatusBanner>
        <dl className="grid gap-3 sm:grid-cols-2">
          <LaunchDate
            label="Posters dispatched"
            value={fulfilment.dispatchedAt}
          />
          <LaunchDate
            label="Delivery confirmed"
            value={fulfilment.deliveredAt}
          />
          <LaunchDate
            label="Platform pilot starts"
            value={fulfilment.pilotStartsAt}
          />
          <LaunchDate
            label="Included 28-day pilot ends"
            value={fulfilment.basePilotEndsAt}
          />
          {fulfilment.approvedExtensionEnd ? (
            <LaunchDate
              label="Approved free extension ends"
              value={fulfilment.approvedExtensionEnd}
            />
          ) : null}
          <LaunchDate
            label={
              deliveryConfirmed
                ? "Recurring billing scheduled"
                : "Recurring billing date"
            }
            value={recurringBillingDate}
            pending={trialEndPending}
          />
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          Allow up to 14 calendar days for print and delivery. If delivery is
          delayed, recurring billing is held back so you keep the usable pilot.
        </p>
      </CardContent>
    </ReceiptCard>
  )
}

function LaunchDate({
  label,
  value,
  pending = false,
}: {
  readonly label: string
  readonly value: string | null
  readonly pending?: boolean
}) {
  return (
    <div className="grid gap-1 border-l-2 border-ink/25 pl-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-semibold">
        {value ? (
          <time dateTime={value}>{formatLaunchDate(value)}</time>
        ) : (
          "To be confirmed"
        )}
        {pending ? (
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Syncing with Stripe
          </span>
        ) : null}
      </dd>
    </div>
  )
}

function formatLaunchDate(value: string): string {
  return dateFormat.format(new Date(value))
}

function statusModel(
  fulfilment: MerchantLaunchFulfilment,
  billingStatus: string | null
): {
  title: string
  detail: string
  tone: "success" | "warning" | "info"
} {
  if (
    fulfilment.operationsReviewRequired ||
    fulfilment.syncStatus === "review_required"
  ) {
    return {
      title: "We are checking your pilot dates",
      detail:
        "Support is reviewing the delivery and Stripe record before any further billing change.",
      tone: "warning",
    }
  }
  if (fulfilment.deliveryUnknown) {
    return {
      title: "We are confirming poster delivery",
      detail:
        "Your account predates delivery tracking. Support will confirm the evidence and protect the remaining pilot time.",
      tone: "warning",
    }
  }
  if (fulfilment.fulfilmentStatus === "awaiting_dispatch") {
    return {
      title: "Your posters are being prepared",
      detail:
        "We will add the dispatch date here when the first run leaves us.",
      tone: "info",
    }
  }
  if (fulfilment.fulfilmentStatus === "dispatched") {
    return {
      title: "Your posters are on the way",
      detail:
        "The 28-day platform pilot has not started yet. It begins when delivery is confirmed.",
      tone: "info",
    }
  }
  if (
    hasLaunchPilotEnded({
      billingStatus,
      syncStatus: fulfilment.syncStatus,
      confirmedStripeTrialEnd: fulfilment.confirmedStripeTrialEnd,
    })
  ) {
    return {
      title: "Your 28-day platform pilot has ended",
      detail: "Your venue is now on its recurring billing schedule.",
      tone: "success",
    }
  }
  if (
    fulfilment.syncStatus === "pending" ||
    fulfilment.syncStatus === "retry"
  ) {
    return {
      title: "Delivery confirmed; billing date is syncing",
      detail:
        "Your platform pilot is running from the delivery date while Stripe is updated safely.",
      tone: "warning",
    }
  }
  return {
    title: "Your 28-day platform pilot is running",
    detail: "Delivery and the recurring billing date are confirmed.",
    tone: "success",
  }
}
