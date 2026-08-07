import { AdminViewTabs } from "@/components/admin/view-tabs"
import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import {
  getAdminFraudQueueCounts,
  getAdminFraudSignals,
  type AdminFraudQueue,
} from "@/lib/admin/data"
import {
  buildLookupHref,
  type AdminSearchParamValue,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

import { FraudFlagsPanel } from "./fraud-flags-panel"
import { RedemptionFailuresPanel } from "./redemption-failures-panel"

export const metadata = { title: "Admin — Fraud" }

const FRAUD_VIEWS = ["open", "high", "all", "failures"] as const
type FraudView = (typeof FRAUD_VIEWS)[number]

/** Unknown/absent `?queue=` lands on the open work, not on everything. */
function parseFraudView(value: AdminSearchParamValue): FraudView {
  const raw = Array.isArray(value) ? value[0] : value
  return FRAUD_VIEWS.includes(raw as FraudView) ? (raw as FraudView) : "open"
}

type AdminFraudPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

/**
 * Triage surface. It used to render every flag newest-first — resolved and open
 * interleaved, no severity priority — above a second stacked panel for
 * redemption failures. The queue now defaults to open work, exposes Open /
 * High / All with live counts, and the failures list is a fourth view rather
 * than a permanently co-visible panel.
 */
export default async function AdminFraudPage({
  searchParams,
}: AdminFraudPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const view = parseFraudView(params.queue)
  const queue: AdminFraudQueue = view === "failures" ? "all" : view

  const [fraud, counts] = await Promise.all([
    getAdminFraudSignals(queue),
    getAdminFraudQueueCounts(),
  ])

  const hrefForView = (next: FraudView) =>
    buildLookupHref("/admin/fraud", {
      queue: next === "open" ? undefined : next,
    })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Fraud"
        description="Fraud flags, soft geofence anomalies, and security-related product events."
      />

      <AdminViewTabs
        label="Fraud queues"
        activeId={view}
        tabs={[
          {
            id: "open",
            label: "Open",
            href: hrefForView("open"),
            count: counts.open,
          },
          {
            id: "high",
            label: "High severity",
            href: hrefForView("high"),
            count: counts.high,
          },
          {
            id: "all",
            label: "All flags",
            href: hrefForView("all"),
            count: counts.all,
          },
          {
            id: "failures",
            label: "Redemption failures",
            href: hrefForView("failures"),
            count: fraud.failures.length,
          },
        ]}
      />

      {view === "failures" ? (
        <RedemptionFailuresPanel failures={fraud.failures} />
      ) : (
        <FraudFlagsPanel flags={fraud.fraudFlags} queue={view} />
      )}
    </div>
  )
}
