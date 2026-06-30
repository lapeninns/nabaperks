import { notFound } from "next/navigation"
import { UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"

import { HARNESS_CUSTOMER_ROWS, HARNESS_TOTAL_MEMBERS } from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Members (customers) harness — mounts the REAL {@link CustomerReadbackTable}
 * (the client body the /app/customers stream renders) with DB-free masked-safe
 * fixture rows, inside the same PageTitle the real route uses. Exercises the
 * StatStrip, search box, FilterPills, the sm+ DataTable and the sub-sm mobile
 * card list.
 */
export default function CustomersHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Members"
        title="Loyalty members"
        description="Stamp progress and reward status for everyone who has joined your card."
      />

      <CustomerReadbackTable
        customers={HARNESS_CUSTOMER_ROWS}
        totalMembers={HARNESS_TOTAL_MEMBERS}
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
