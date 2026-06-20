import { UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, MonoTag, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { MERCHANT_CUSTOMERS } from "./mock-data"

/**
 * Mirror of `/app/customers`. Reuses the real `CustomerReadbackTable` (a client
 * component) with mock `MerchantCustomerReadbackRow[]` — initials-only,
 * phones-hashed, exactly the masked-safe view models the production page builds.
 *
 * `empty` swaps the rows to `[]` so the screen renders the route's real
 * `EmptyState` (no broken table shell) — the empty-state preview variant.
 */
export function MerchantCustomersScreen({
  empty = false,
}: {
  empty?: boolean
}) {
  const customers = empty ? [] : MERCHANT_CUSTOMERS
  const readyCount = customers.filter((c) => c.badge.tone === "ready").length
  const quietCount = customers.filter((c) => c.badge.tone === "quiet").length

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Customers"
        title="Loyalty members"
        description="Stamp progress and reward status for everyone who has joined your card."
      />

      <div className="grid gap-3">
        {customers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <MonoTag tone="ink">
              {customers.length} {customers.length === 1 ? "member" : "members"}
              {readyCount > 0 ? ` · ${readyCount} ready to redeem` : ""}
              {quietCount > 0 ? ` · ${quietCount} gone quiet` : ""}
            </MonoTag>
            <MonoTag tone="plain">Initials only · Phones stay hashed</MonoTag>
          </div>
        ) : null}

        <CustomerReadbackTable
          customers={customers}
          emptyState={
            <EmptyState
              title="No customers yet"
              description="Customers will appear here after they join via the venue QR."
              icon={UserMultiple02Icon}
            />
          }
        />
      </div>
    </div>
  )
}
