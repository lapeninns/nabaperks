import Link from "next/link"
import { redirect } from "next/navigation"

import {
  EmptyState,
  MetricTile,
  PageTitle,
  SectionHeader,
} from "@/components/brand"
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
        {dashboard.recentActivity.length ? (
          <div className="divide-y">
            {dashboard.recentActivity.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No activity yet"
            description="Activity will appear here after customers join, stamps are issued, rewards are redeemed, or QR assets are downloaded."
            className="bg-background"
          />
        )}
      </section>
    </div>
  )
}

function BillingNotice({ status }: { status: string }) {
  if (!["past_due", "cancelled", "suspended"].includes(status)) return null

  const disabled = ["cancelled", "suspended"].includes(status)

  return (
    <section className="rounded-3xl border border-destructive/30 bg-destructive/10 p-5">
      <h2 className="text-lg font-extrabold text-destructive">
        Billing {formatStatus(status)}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {disabled
          ? "New customer actions are disabled until billing is restored."
          : "Payment needs attention. Loyalty remains visible, but billing should be resolved."}
      </p>
    </section>
  )
}

function ActivityRow({
  item,
}: {
  item: { event_name: string; created_at: string }
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 text-sm">
      <span className="font-bold">{activityLabel(item.event_name)}</span>
      <time className="text-muted-foreground" dateTime={item.created_at}>
        {formatDate(item.created_at)}
      </time>
    </div>
  )
}

function activityLabel(eventName: string) {
  const labels: Record<string, string> = {
    customer_joined: "Customer joined",
    stamp_issued: "Stamp issued",
    reward_redeemed: "Reward redeemed",
    qr_downloaded: "QR downloaded",
    qr_created: "QR created",
    loyalty_card_created: "Card created",
    loyalty_card_updated: "Card updated",
    merchant_signed_up: "Merchant signed up",
  }

  return labels[eventName] ?? eventName.replaceAll("_", " ")
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
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
