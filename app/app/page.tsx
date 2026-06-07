import Link from "next/link"
import { redirect } from "next/navigation"

import {
  EmptyState,
  MetricTile,
  PageTitle,
  SectionHeader,
} from "@/components/brand"
import { ActivityFeed } from "@/components/data"
import { Button } from "@/components/ui/button"
import { capturePostHogEvent } from "@/lib/analytics/events"
import { getMerchantDashboardData } from "@/lib/merchant/dashboard"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"

export default async function MerchantAppPage() {
  const setup = await getMerchantOnboardingStatus()

  if (setup.status !== "complete") {
    redirect("/app/onboarding")
  }

  const merchant = setup.merchant
  const dashboard = await getMerchantDashboardData(merchant)
  const metrics = dashboard.metrics

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
            <Link href="/app/qr">Launch QR</Link>
          </Button>
        }
      />

      <BillingNotice status={dashboard.billingStatus} />

      {metrics.members === 0 ? (
        <EmptyState
          title="No members yet"
          description="Generate the venue QR and place it at the till so customers can join before their next order."
          actions={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/app/qr">Generate QR</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/card">Check card setup</Link>
              </Button>
            </div>
          }
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Members" value={metrics.members.toString()} />
        <MetricTile
          label="New members (7d)"
          value={metrics.newMembers.toString()}
        />
        <MetricTile
          label="Stamps issued"
          value={metrics.stampsIssued.toString()}
        />
        <MetricTile
          label="Repeat customers"
          value={metrics.repeatCustomers.toString()}
        />
        <MetricTile
          label="Rewards redeemed"
          value={metrics.rewardsRedeemed.toString()}
        />
        <MetricTile
          label="QR downloads"
          value={metrics.qrDownloads.toString()}
        />
        <MetricTile
          label="Billing status"
          value={formatStatus(dashboard.billingStatus)}
        />
        <MetricTile
          label="Estimated repeat revenue"
          value={formatPence(metrics.estimatedRepeatRevenuePence)}
          helper="Estimate only: repeat customers x average order value."
        />
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader
          title="Recent activity"
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/activity">View all</Link>
            </Button>
          }
        />
        <ActivityFeed
          items={dashboard.recentActivity.map(ActivityRow)}
          className="border-0 bg-background shadow-none"
          emptyState={
            <EmptyState
              title="No activity yet"
              description="Activity will appear here after customers join, stamps are issued, rewards are redeemed, or QR assets are downloaded."
              className="bg-background"
            />
          }
        />
      </section>
    </div>
  )
}

function BillingNotice({ status }: { status: string }) {
  const billing = billingStateCopy(status)

  return (
    <section className={billing.className}>
      <SectionHeader
        title={
          <span className={billing.titleClassName}>{billing.title}</span>
        }
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

function ActivityRow(item: {
  id: string
  event_name: string
  created_at: string
  metadata: Record<string, unknown>
}) {
  return {
    id: item.id,
    title: activityLabel(item.event_name),
    timestamp: item.created_at,
    metadata: activityMetadata(item.metadata),
  }
}

function activityLabel(eventName: string) {
  const labels: Record<string, string> = {
    qr_scanned: "QR scanned",
    customer_joined: "Customer joined",
    stamp_claim_started: "Stamp claim started",
    stamp_issued: "Stamp issued",
    reward_unlocked: "Reward unlocked",
    reward_redeemed: "Reward redeemed",
    qr_downloaded: "QR downloaded",
    qr_created: "QR created",
    loyalty_card_created: "Card created",
    loyalty_card_updated: "Card updated",
    merchant_signed_up: "Merchant signed up",
    subscription_started: "Subscription started",
    subscription_cancelled: "Subscription cancelled",
  }

  return labels[eventName] ?? eventName.replaceAll("_", " ")
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

function activityMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata?.asset_type && !metadata?.status && !metadata?.plan) return null

  return [
    metadata.asset_type ? `Asset: ${String(metadata.asset_type)}` : null,
    metadata.status ? `Status: ${String(metadata.status)}` : null,
    metadata.plan ? `Plan: ${String(metadata.plan)}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ")
}

function billingStateCopy(status: string) {
  const state = status === "trial" ? "trialing" : status
  const baseClassName = "rounded-3xl border p-5 shadow-xs"

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
        "Stripe marks this merchant as active. Loyalty participation and staff stamping stay enabled.",
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
