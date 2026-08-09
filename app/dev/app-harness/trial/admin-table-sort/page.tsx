import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { ADMIN_FRAUD_SORT_COLUMNS } from "@/lib/admin/data"
import {
  buildLookupHref,
  parseAdminSortParams,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HARNESS_PATH = "/dev/app-harness/trial/admin-table-sort"

/** Deterministic rows: this harness proves the CONTROL, not the ordering. */
const ROWS = [
  { id: "flag-1", signal: "High stamp velocity", severity: "high" },
  { id: "flag-2", signal: "Geofence anomaly", severity: "medium" },
  { id: "flag-3", signal: "Repeat redemption", severity: "low" },
] as const

/**
 * `DataTable` sortable headers (ADM 04#60).
 *
 * Every admin list is behind the console auth wall — `/admin/*` redirects to
 * `/login` — so the sort control could only ever be asserted from source. This
 * mounts the REAL `DataTable` with the REAL `ADMIN_FRAUD_SORT_COLUMNS`
 * allowlist and the REAL `parseAdminSortParams`/`buildLookupHref` pair, so the
 * URL round-trip a browser test drives here is the one that ships.
 *
 * What it does NOT do is re-order the rows: the ordering is an ORDER BY in
 * PostgreSQL (`severity_rank`, added by 20260809100000) and is proved in the
 * live-DB tier by tests/db/admin-fraud-queue-order.test.mjs. Re-implementing a
 * comparator here would be exactly the harness drift that has already caused
 * two wrong conclusions on this branch.
 */
export default async function AdminTableSortHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<AdminSearchParams>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const params = searchParams ? await searchParams : {}
  const sort = parseAdminSortParams(
    params,
    Object.keys(ADMIN_FRAUD_SORT_COLUMNS)
  )

  return (
    <main className="mx-auto grid w-full max-w-merchant gap-5 px-4 py-8">
      <PageTitle
        eyebrow="Harness"
        title="Sortable table headers"
        description="Sortable headers are links, so a sorted view is linkable and works with no JavaScript. Press a header to sort; press the active one again to reverse it."
      />
      <p id="harness-active-sort" className="mono-meta text-muted-foreground">
        sort={sort.key ?? "default"} dir={sort.key ? sort.direction : "—"}
      </p>
      <DataTable
        caption="Sortable header harness"
        rows={[...ROWS]}
        getRowKey={(row) => row.id}
        sort={{
          ...sort,
          hrefFor: (key, direction) =>
            buildLookupHref(HARNESS_PATH, { sort: key, dir: direction }),
        }}
        columns={[
          {
            key: "signal",
            header: "Signal",
            cell: (row) => row.signal,
          },
          {
            key: "severity",
            header: "Severity",
            sortKey: "severity",
            cell: (row) => row.severity,
          },
          {
            key: "when",
            header: "When",
            sortKey: "when",
            cell: () => "9 Aug 2026",
          },
        ]}
      />
    </main>
  )
}
