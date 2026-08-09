import { AdminViewTabs } from "@/components/admin/view-tabs"
import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import {
  ADMIN_FRAUD_SORT_COLUMNS,
  getAdminFraudFlags,
  getAdminFraudQueueCounts,
  getAdminRedemptionFailures,
  type AdminFraudQueue,
} from "@/lib/admin/data"
import {
  buildLookupHref,
  parseAdminLookupParams,
  parseAdminSortParams,
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
 *
 * Both views take the shared venue lookup and paginator (04#6). Only the active
 * view is read: the two lists share one `?page=` because they are never
 * co-visible, and the tab counts come from head-only counts rather than from
 * the length of a loaded window.
 */
export default async function AdminFraudPage({
  searchParams,
}: AdminFraudPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const view = parseFraudView(params.queue)
  const lookup = parseAdminLookupParams(params)
  const sort = parseAdminSortParams(params, Object.keys(ADMIN_FRAUD_SORT_COLUMNS))
  const queue: AdminFraudQueue = view === "failures" ? "all" : view

  // Counts first so the loader the service-role guard contract inspects is the
  // first thing awaited after the gate, and so the tab counts are a head-only
  // count rather than the length of whichever window happens to be loaded.
  const [counts, flags, failures] = await Promise.all([
    getAdminFraudQueueCounts(),
    view === "failures" ? null : getAdminFraudFlags(queue, lookup, sort),
    view === "failures" ? getAdminRedemptionFailures(lookup) : null,
  ])

  const hrefForView = (next: FraudView) =>
    buildLookupHref("/admin/fraud", {
      queue: next === "open" ? undefined : next,
      // A view switch keeps the venue the operator is investigating but starts
      // that view at its own first page — page 7 of the flags queue is not
      // page 7 of the failures list.
      venue: lookup.venue,
      size: lookup.size,
    })

  const hrefForPage = (page: number) =>
    buildLookupHref("/admin/fraud", {
      queue: view === "open" ? undefined : view,
      venue: lookup.venue,
      sort: sort.key ?? undefined,
      dir: sort.key ? sort.direction : undefined,
      page,
      size: lookup.size,
    })

  // A new order makes the current page number meaningless, so sorting starts
  // at page 1 — the same reason submitting the search does.
  const hrefForSort = (key: string, direction: "asc" | "desc") =>
    buildLookupHref("/admin/fraud", {
      queue: view === "open" ? undefined : view,
      venue: lookup.venue,
      sort: key,
      dir: direction,
      size: lookup.size,
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
            count: counts.failures,
          },
        ]}
      />

      {failures ? (
        <RedemptionFailuresPanel
          failures={failures.rows}
          meta={failures.meta}
          lookup={lookup}
          view={view}
          hrefForPage={hrefForPage}
        />
      ) : null}
      {flags ? (
        <FraudFlagsPanel
          flags={flags.rows}
          meta={flags.meta}
          lookup={lookup}
          queue={view}
          hrefForPage={hrefForPage}
          sort={{ ...sort, hrefFor: hrefForSort }}
        />
      ) : null}
    </div>
  )
}
