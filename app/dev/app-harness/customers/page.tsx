import { notFound } from "next/navigation"
import { UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import {
  parseCustomerFilterParam,
  parseCustomerSearchParam,
  type CustomerFilter,
} from "@/lib/merchant/customers-filter"
import type { MerchantCustomerReadbackRow } from "@/lib/merchant/customer-readback"

import { HARNESS_CUSTOMER_ROWS, HARNESS_TOTAL_MEMBERS } from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HARNESS_PATH = "/dev/app-harness/customers"

/**
 * Members (customers) harness — mounts the REAL {@link CustomerReadbackTable}
 * (the client body the /app/customers stream renders) with DB-free masked-safe
 * fixture rows, inside the same PageTitle the real route uses. Exercises the
 * search box, FilterPills, the readback line, the lg+ DataTable and the sub-lg
 * mobile card list.
 *
 * `basePath` keeps every control inside the harness: the narrowing lives in the
 * URL now (03#18), so without it the first pill click would navigate to the
 * auth-gated /app/customers route and leave the harness.
 *
 * The narrowing below is a fixture approximation, NOT the production rule. The
 * real filter is a merchant-scoped database predicate in
 * `lib/merchant/customers-view.ts`; this harness has no database, so it
 * narrows the fixture rows just enough for the controls to be operable and the
 * empty state reachable.
 */
export default async function CustomersHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string | string[]; q?: string | string[] }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const filter = parseCustomerFilterParam(params.filter)
  const search = parseCustomerSearchParam(params.q)
  const rows = narrowFixtureRows(HARNESS_CUSTOMER_ROWS, filter, search)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Members"
        title="Loyalty members"
        description="Stamp progress and reward status for everyone who has joined your card."
      />

      <CustomerReadbackTable
        customers={rows}
        totalMembers={HARNESS_TOTAL_MEMBERS}
        matchedMembers={rows.length}
        counts={fixtureCounts(HARNESS_CUSTOMER_ROWS)}
        filter={filter}
        query={search ?? ""}
        basePath={HARNESS_PATH}
        emptyState={
          <EmptyState
            title="No members yet"
            description="Members will appear here after they join via the venue QR."
            icon={UserMultiple02Icon}
          />
        }
      />
    </div>
  )
}

function matchesFixtureFilter(
  row: MerchantCustomerReadbackRow,
  filter: CustomerFilter
) {
  switch (filter) {
    case "ready":
      return row.badge.redeemable
    case "quiet":
      return row.badge.tone === "quiet"
    case "active":
      return row.lastVisitIso != null && row.badge.tone !== "quiet"
    default:
      return true
  }
}

function narrowFixtureRows(
  rows: MerchantCustomerReadbackRow[],
  filter: CustomerFilter,
  search: string | undefined
) {
  const needle = search?.toLowerCase()

  return rows.filter((row) => {
    if (!matchesFixtureFilter(row, filter)) return false
    if (!needle) return true
    return (
      row.identifier.toLowerCase().includes(needle) ||
      (row.phoneLine?.toLowerCase().includes(needle) ?? false)
    )
  })
}

function fixtureCounts(rows: MerchantCustomerReadbackRow[]) {
  return {
    all: HARNESS_TOTAL_MEMBERS,
    ready: rows.filter((row) => matchesFixtureFilter(row, "ready")).length,
    active: rows.filter((row) => matchesFixtureFilter(row, "active")).length,
    quiet: rows.filter((row) => matchesFixtureFilter(row, "quiet")).length,
  }
}
