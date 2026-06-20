import Link from "next/link"
import {
  CheckmarkBadge04Icon,
  Download01Icon,
  GiftIcon,
  QrCode01Icon,
  RefreshIcon,
  UserAdd01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  Icon,
  MetricTile,
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { Button } from "@/components/ui/button"
import {
  MERCHANT_COMPACT_ACTIVITY,
  MERCHANT_DASHBOARD_METRICS,
  MERCHANT_PREVIEW_MOCK,
} from "./mock-data"

const SECONDARY_ICONS = [
  UserAdd01Icon,
  CheckmarkBadge04Icon,
  RefreshIcon,
  GiftIcon,
  Download01Icon,
]

/**
 * Mirror of `/app` (the merchant dashboard). The live page streams metrics and
 * activity from Supabase via `MerchantDashboardStream`; here the real leaf
 * presentation pieces (the Members hero, `MetricTile` grid, and the reusable
 * `ActivityCompactFeed`) render against deterministic mock data.
 */
export function MerchantDashboardScreen() {
  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Your venue"
        title={MERCHANT_PREVIEW_MOCK.businessName}
        description="A quick read on how your loyalty card is doing: members, repeat visits, and rewards."
        actions={
          <Button asChild>
            <Link href="/app/launch">
              <Icon icon={QrCode01Icon} size={16} />
              Launch QR
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-6 overflow-hidden rounded-lg border-2 border-ink bg-card p-6 shadow-sm">
          <div className="grid content-start gap-2">
            <p className="eyebrow">Members</p>
            <p className="numeric-tabular text-5xl leading-none font-extrabold sm:text-6xl">
              {MERCHANT_DASHBOARD_METRICS.members}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              People carrying your card right now.
            </p>
          </div>
          <span className="hidden size-20 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-accent text-accent-foreground shadow-sm sm:grid">
            <Icon icon={UserMultiple02Icon} size={36} />
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MERCHANT_DASHBOARD_METRICS.secondary.map((metric, index) => (
            <MetricTile
              key={metric.label}
              label={metric.label}
              value={metric.value}
              icon={SECONDARY_ICONS[index]}
            />
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
          rows={MERCHANT_COMPACT_ACTIVITY}
          emptyState={null}
        />
      </ReceiptCard>
    </div>
  )
}
