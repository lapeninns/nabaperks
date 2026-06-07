import type { ReactNode } from "react"

import { DataTable, type DataTableColumn } from "@/components/data"
import type { MerchantCustomerRow } from "@/lib/merchant/dashboard"

type CustomerIdentity = {
  email: string | null
  phone: string | null
}

export function CustomerReadbackTable({
  customers,
  emptyState,
}: {
  customers: MerchantCustomerRow[]
  emptyState: ReactNode
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
      caption="Merchant loyalty customer readbacks"
      columns={columns}
      rows={customers}
      getRowKey={(row) => row.id}
      emptyState={emptyState}
    />
  )
}

export function formatMerchantCustomerIdentifier(customer: CustomerIdentity) {
  return customer.email ?? customer.phone ?? "Customer"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
