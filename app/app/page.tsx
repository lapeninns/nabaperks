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
import { MerchantBillingNotice } from "@/components/merchant/billing-status"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { MotionReveal } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { capturePostHogEvent } from "@/lib/analytics/events"
import { getEnrichedMerchantActivity } from "@/lib/merchant/activity"
import { getMerchantDashboardData } from "@/lib/merchant/dashboard"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"

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
  const secondaryMetrics = [
    { label: "New members (7d)", value: metrics.newMembers.toString() },
    { label: "Stamps issued", value: metrics.stampsIssued.toString() },
    { label: "Repeat customers", value: metrics.repeatCustomers.toString() },
    { label: "Rewards redeemed", value: metrics.rewardsRedeemed.toString() },
    { label: "QR downloads", value: metrics.qrDownloads.toString() },
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
        eyebrow="Your venue"
        title={merchant.business_name}
        description="A quick read on how your loyalty card is doing — members, repeat visits, and rewards."
        actions={
          <Button asChild>
            <Link href="/app/launch">Launch QR</Link>
          </Button>
        }
      />

      <MerchantBillingNotice status={dashboard.billingStatus} />
      {!launchReadiness.launchReady ? (
        <LaunchReadinessPanel readiness={launchReadiness} />
      ) : null}

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

      <section className="grid gap-3">
        <div className="grid overflow-hidden rounded-lg border-2 border-ink bg-card shadow-sm sm:grid-cols-2">
          <div className="grid content-start gap-2 border-b-2 border-ink p-6 sm:border-r-2 sm:border-b-0">
            <p className="eyebrow">Members</p>
            <p className="numeric-tabular text-4xl font-extrabold leading-none sm:text-5xl">
              {metrics.members}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              People carrying your card right now.
            </p>
          </div>
          <div className="grid content-start gap-2 p-6">
            <p className="eyebrow">Estimated repeat revenue</p>
            <p className="numeric-tabular text-4xl font-extrabold leading-none sm:text-5xl">
              {formatPence(metrics.estimatedRepeatRevenuePence)}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Estimate only, from repeat visits at your average order value.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryMetrics.map((metric, index) => (
            <MotionReveal key={metric.label} delay={index * 0.045} distance={12}>
              <MetricTile label={metric.label} value={metric.value} />
            </MotionReveal>
          ))}
        </div>
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

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
