import { SecurityCheckIcon } from "@hugeicons/core-free-icons"
import { notFound } from "next/navigation"

import {
  AdminEmptyState,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
} from "@/components/admin/support"
import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import {
  buildLookupHref,
  parseAdminLookupParams,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HARNESS_PATH = "/dev/admin-harness/audit-lookup"

/**
 * Filler rows, so the panel is taller than any viewport this is measured at
 * and the sticky bar has something to stick against. They carry no product
 * meaning and no production markup: the audit trail's own cells are built in
 * `app/admin/audit/page.tsx` and stay there.
 */
const ROWS = Array.from({ length: 60 }, (_, index) => ({
  id: `row-${index + 1}`,
  action: "reward_redeemed",
  venue: "The Old Crown",
}))

/**
 * The admin lookup bar at intermediate widths (NEEDS-SIGNOFF 44, ADM 04#26).
 *
 * `/admin/audit` is the one lookup surface that carries four controls —
 * venue + from + to + the Search/Clear pair — and `/admin/*` redirects to
 * `/login`, so **no one has ever seen the wrapped bar at 768px or 1024px**.
 * The behaviour is contract-tested; the appearance was not, and could not be.
 *
 * This mounts the REAL `AdminLookupControls` with the REAL `withDateRange`
 * and `sticky="flush"` props the audit page passes it, inside the REAL
 * `AdminPanel`/`AdminPanelHeader` chrome, so what a browser measures here is
 * the component that ships. Nothing is re-implemented: the five existing
 * harnesses that copied production markup drifted, and that drift caused two
 * wrong conclusions on this branch.
 *
 * The audit page itself is deliberately NOT refactored to share a view
 * component: `tests/contracts/admin-member-lookup.test.mjs` reads
 * `app/admin/audit/page.tsx` for `withDateRange` and for its paging hrefs, and
 * moving that markup would break assertions the audit has no standing to
 * weaken.
 */
export default async function AdminLookupHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<AdminSearchParams>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const searching = Boolean(lookup.venue || lookup.from || lookup.to)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Harness"
        title="Audit lookup bar"
        description="The four-control sticky lookup bar the audit trail uses: venue, an inclusive from/to pair, and the Search/Clear row. Resize to 768px or 1024px to see how it wraps."
      />
      <AdminPanel variant="flush">
        <AdminPanelHeader>
          <SectionHeader
            title="Audit trail"
            description="Search by venue and date to answer questions about one merchant on one day."
            actions={<SourceLabel>Source: audit_logs</SourceLabel>}
          />
        </AdminPanelHeader>
        <AdminLookupControls
          sticky="flush"
          basePath={HARNESS_PATH}
          lookup={lookup}
          label="Audit log lookup"
          fields="venue"
          withDateRange
        />
        <AdminAppliedFilters basePath={HARNESS_PATH} lookup={lookup} />
        <DataTable
          caption="Lookup bar harness rows"
          cardBreakpoint="xl"
          className="rounded-none border-0 shadow-none"
          mobileClassName="p-5"
          rows={searching ? [] : ROWS}
          getRowKey={(row) => row.id}
          emptyState={
            <AdminEmptyState
              icon={SecurityCheckIcon}
              title="No matching audit entries"
              description="The harness returns nothing while a filter is applied, so the applied-filter chips and the empty state can be seen together."
            />
          }
          columns={[
            { key: "action", header: "Action", cell: (row) => row.action },
            { key: "venue", header: "Context", cell: (row) => row.venue },
            { key: "when", header: "When", cell: () => "9 Aug 2026, 14:02" },
          ]}
        />
        <AdminPanelFooter className="pt-0">
          <AdminLookupPagination
            label="Audit log pages"
            unit="audited actions"
            meta={{
              page: 1,
              pageCount: 12,
              pageSize: lookup.size,
              total: 288,
            }}
            hrefForPage={(page) =>
              buildLookupHref(HARNESS_PATH, {
                venue: lookup.venue,
                from: lookup.from,
                to: lookup.to,
                page,
                size: lookup.size,
              })
            }
          />
        </AdminPanelFooter>
      </AdminPanel>
    </div>
  )
}
