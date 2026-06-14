import Link from "next/link"
import { redirect } from "next/navigation"

import {
  EmptyState,
  MetricTile,
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { MotionReveal } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { capturePostHogEvent } from "@/lib/analytics/events"
import { getEnrichedMerchantActivity } from "@/lib/merchant/activity"
import { getMerchantDashboardData } from "@/lib/merchant/dashboard"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"

export default async function MerchantAppPage() {
  const setup = await getMerchantOnboardingStatus()

  if (setup.status !== "complete") {
    redirect("/app/onboarding")
  }

  const merchant = setup.merchant
  const [dashboard, compactActivity, launchReadiness] = await Promise.all([
    getMerchantDashboardData(merchant),
    getEnrichedMerchantActivity(merchant.id, { limit: 6 }),
    getMerchantLaunchReadiness(),
  ])
  const metrics = dashboard.metrics
  const metricTiles = [
    { label: "Members", value: metrics.members.toString() },
    { label: "New members (7d)", value: metrics.newMembers.toString() },
    { label: "Stamps issued", value: metrics.stampsIssued.toString() },
    { label: "Repeat customers", value: metrics.repeatCustomers.toString() },
    { label: "Rewards redeemed", value: metrics.rewardsRedeemed.toString() },
    { label: "QR downloads", value: metrics.qrDownloads.toString() },
    { label: "Billing status", value: formatStatus(dashboard.billingStatus) },
    {
      label: "Estimated repeat revenue",
      value: formatPence(metrics.estimatedRepeatRevenuePence),
      helper: "Estimate only: repeat customers x average order value.",
    },
  ]

  await capturePostHogEvent({
    eventName: "dashboard_viewed",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
  })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Merchant dashboard"
        title={merchant.business_name}
        description="Current MVP metrics for this merchant only."
        actions={
          <Button asChild>
            <Link href="/app/launch">Launch QR</Link>
          </Button>
        }
      />

      <BillingNotice status={dashboard.billingStatus} />
      <LaunchReadinessPanel readiness={launchReadiness} />

      {metrics.members === 0 ? (
        <EmptyState
          title="No members yet"
          description="Generate the venue QR and place it at the till so customers can join before their next order."
          actions={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/app/launch?tab=qr">Generate QR</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/launch?tab=card">Check card setup</Link>
              </Button>
            </div>
          }
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricTiles.map((metric, index) => (
          <MotionReveal key={metric.label} delay={index * 0.045} distance={12}>
            <MetricTile
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
            />
          </MotionReveal>
        ))}
      </section>

      <ReceiptCard className="grid gap-4">
        <SectionHeader
          title="Recent activity"
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/activity">View all</Link>
            </Button>
          }
        />
        <ActivityCompactFeed
          rows={compactActivity.rows}
          emptyState={
            <EmptyState
              title="No activity yet"
              description="Activity will appear here after customers join, stamps are issued, rewards are redeemed, or QR assets are downloaded."
              className="bg-background"
            />
          }
        />
      </ReceiptCard>
    </div>
  )
}

function BillingNotice({ status }: { status: string }) {
  const billing = billingStateCopy(status)

  return (
    <section className={billing.className}>
      <SectionHeader
        title={<span className={billing.titleClassName}>{billing.title}</span>}
        description={billing.description}
        actions={
          billing.actionHref ? (
            <Button asChild variant={billing.actionVariant} size="sm">
              <Link href={billing.actionHref}>{billing.actionLabel}</Link>
            </Button>
          ) : null
        }
      />
    </section>
  )
}

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ")
}

function billingStateCopy(status: string) {
  const state = status === "trial" ? "trialing" : status
  const baseClassName = "rounded-lg border-2 p-5 shadow-md"

  const states: Record<
    string,
    {
      title: string
      description: string
      className: string
      titleClassName?: string
      actionHref?: string
      actionLabel?: string
      actionVariant?: "default" | "secondary"
    }
  > = {
    not_started: {
      title: "Billing not started",
      description:
        "Start checkout when the venue is ready. Customers can be configured, but billing should be activated before launch.",
      className: `${baseClassName} border-primary/30 bg-primary/10`,
      actionHref: "/app/billing",
      actionLabel: "Start billing",
      actionVariant: "default",
    },
    trialing: {
      title: "Trial active",
      description:
        "The 30-day Growth Plan pilot is running with full MVP access.",
      className: `${baseClassName} border-reward/30 bg-accent`,
      actionHref: "/app/billing",
      actionLabel: "View billing",
      actionVariant: "secondary",
    },
    active: {
      title: "Billing active",
      description:
        "Stripe marks this merchant as active. Loyalty participation and self-service stamping stay enabled.",
      className: `${baseClassName} border-reward/30 bg-reward/10`,
      actionHref: "/app/billing",
      actionLabel: "Manage billing",
      actionVariant: "secondary",
    },
    past_due: {
      title: `Billing ${formatStatus(status)}`,
      description:
        "Payment needs attention. Loyalty remains visible, but billing should be resolved.",
      className: `${baseClassName} border-destructive/30 bg-destructive/10`,
      titleClassName: "text-destructive",
      actionHref: "/app/billing",
      actionLabel: "Resolve billing",
      actionVariant: "default",
    },
    cancelled: {
      title: `Billing ${formatStatus(status)}`,
      description:
        "New customer actions are disabled until billing is restored.",
      className: `${baseClassName} border-destructive/30 bg-destructive/10`,
      titleClassName: "text-destructive",
      actionHref: "/app/billing",
      actionLabel: "Restart billing",
      actionVariant: "default",
    },
    suspended: {
      title: `Billing ${formatStatus(status)}`,
      description:
        "New customer actions are disabled until billing is restored.",
      className: `${baseClassName} border-destructive/30 bg-destructive/10`,
      titleClassName: "text-destructive",
      actionHref: "/app/billing",
      actionLabel: "Restore access",
      actionVariant: "default",
    },
  }

  return (
    states[state] ?? {
      title: `Billing ${formatStatus(status)}`,
      description:
        "Billing status is available for support review. Check Stripe before changing customer access.",
      className: `${baseClassName} border-border bg-card`,
      actionHref: "/app/billing",
      actionLabel: "Review billing",
      actionVariant: "secondary",
    }
  )
}
