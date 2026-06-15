import type { ReactNode } from "react"

import { DataTable, type DataTableColumn } from "@/components/data"
import type { MerchantCustomerRow } from "@/lib/merchant/dashboard"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"

export function CustomerReadbackTable({
  customers,
  emptyState,
  highlightedMembershipId,
}: {
  customers: MerchantCustomerRow[]
  emptyState: ReactNode
  highlightedMembershipId?: string
}) {
  const columns: DataTableColumn<MerchantCustomerRow>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (row) => (
        <span className="font-bold">
          {formatMerchantCustomerIdentifier(row.customer)}
        </span>
      ),
    },
    {
      key: "current",
      header: "Current stamps",
      cell: (row) => (
        <span className="numeric-tabular">{row.current_stamp_count}</span>
      ),
    },
    {
      key: "total",
      header: "Total stamps",
      cell: (row) => (
        <span className="numeric-tabular">{row.total_stamps_earned}</span>
      ),
    },
    {
      key: "rewards",
      header: "Rewards redeemed",
      cell: (row) => (
        <span className="numeric-tabular">{row.total_rewards_redeemed}</span>
      ),
    },
    {
      key: "lastVisit",
      header: "Last visit",
      cell: (row) =>
        row.last_visit_at ? (
          <time
            className="text-muted-foreground"
            dateTime={row.last_visit_at}
          >
            {formatDate(row.last_visit_at)}
          </time>
        ) : (
          <span className="text-muted-foreground">Not visited yet</span>
        ),
    },
  ]

  return (
    <DataTable
      caption="Your loyalty members and their stamp progress"
      columns={columns}
      rows={customers}
      getRowKey={(row) => row.id}
      emptyState={emptyState}
      rowClassName={(row) =>
        row.id === highlightedMembershipId
          ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
          : undefined
      }
    />
  )
}

export { formatMerchantCustomerIdentifier }

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
