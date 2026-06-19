import {
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { CreditCardIcon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { getAdminBillingRecords } from "@/lib/admin/data"

export default async function AdminBillingPage() {
  const billing = await getAdminBillingRecords()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Billing"
        description="Stripe subscription state synced into Supabase."
      />

      <AdminPanel className="p-0">
        <div className="border-b p-5">
          <SourceLabel>Source: billing_customers</SourceLabel>
        </div>
        <DataTable
          caption="Admin billing subscription readback"
          cardBreakpoint="lg"
          className="rounded-none border-0 shadow-none"
          rows={billing}
          getRowKey={(row) => row.id}
          emptyState={
            <EmptyState
              icon={CreditCardIcon}
              title="No billing records yet"
              className="rounded-none border-0 shadow-none"
            />
          }
          columns={[
            {
              key: "merchant",
              header: "Merchant",
              cell: (row) => {
                const merchant = first(row.merchants)
                return (
                  <div className="grid gap-1">
                    <span className="font-bold">
                      {merchant?.business_name ?? "Merchant"}
                    </span>
                    <span className="text-muted-foreground">
                      {merchant?.email ?? "No merchant email"}
                    </span>
                  </div>
                )
              },
            },
            {
              key: "plan",
              header: "Plan",
              cell: (row) => row.plan,
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => <StatusPill>{row.status}</StatusPill>,
            },
            {
              key: "period",
              header: "Period end",
              cell: (row) => (
                <span className="text-muted-foreground">
                  {formatAdminDate(row.current_period_end)}
                </span>
              ),
            },
            {
              key: "stripe",
              header: "Stripe subscription",
              cell: (row) => (
                <span className="font-mono text-xs">
                  {row.stripe_subscription_id ?? "-"}
                </span>
              ),
            },
          ]}
          mobileCard={(row) => {
            const merchant = first(row.merchants)
            return (
              <AdminRecordCard
                title={merchant?.business_name ?? "Merchant"}
                status={<StatusPill>{row.status}</StatusPill>}
                fields={[
                  {
                    label: "Email",
                    value: merchant?.email ?? "No merchant email",
                  },
                  { label: "Plan", value: row.plan },
                  {
                    label: "Period end",
                    value: formatAdminDate(row.current_period_end),
                  },
                  {
                    label: "Stripe subscription",
                    value: row.stripe_subscription_id ?? "-",
                    mono: true,
                  },
                ]}
              />
            )
          }}
        />
      </AdminPanel>
    </div>
  )
}
