import { PlusSignIcon, UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { adjustStampsAction } from "@/app/admin/actions"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  adminInputClasses,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, Icon, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import type { getAdminCustomers } from "@/lib/admin/data"

type AdminCustomers = Awaited<ReturnType<typeof getAdminCustomers>>

export function CustomerMembershipsPanel({
  customers,
}: {
  readonly customers: AdminCustomers
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Memberships"
        description="Masked customer contacts and merchant-scoped stamp counters from service-role support reads."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      <DataTable
        caption="Admin customer membership support readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={customers}
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={UserMultiple02Icon}
            title="No customer memberships yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        }
        mobileCard={(row) => {
          const customer = first(row.customers)
          const merchant = first(row.merchants)
          return (
            <AdminRecordCard
              title={maskAdminContact(customer?.email ?? customer?.phone)}
              fields={[
                {
                  label: "Merchant",
                  value: merchant?.business_name ?? "Merchant",
                },
                {
                  label: "Stamps",
                  value: (
                    <span className="numeric-tabular">
                      {row.current_stamp_count} current ·{" "}
                      {row.total_stamps_earned} total
                    </span>
                  ),
                },
                {
                  label: "Rewards redeemed",
                  value: (
                    <span className="numeric-tabular">
                      {row.total_rewards_redeemed}
                    </span>
                  ),
                },
                {
                  label: "Joined",
                  mono: true,
                  value: (
                    <time dateTime={row.created_at}>
                      {formatAdminDate(row.created_at)}
                    </time>
                  ),
                },
              ]}
              action={<StampAdjustmentForm membershipId={row.id} />}
            />
          )
        }}
        columns={[
          {
            key: "customer",
            header: "Customer",
            cell: (row) => {
              const customer = first(row.customers)
              const merchant = first(row.merchants)
              return (
                <div className="grid gap-1">
                  <span className="font-bold">
                    {maskAdminContact(customer?.email ?? customer?.phone)}
                  </span>
                  <span className="text-muted-foreground">
                    {merchant?.business_name ?? "Merchant"}
                  </span>
                </div>
              )
            },
          },
          {
            key: "stamps",
            header: "Stamps",
            cell: (row) => (
              <span className="numeric-tabular">
                {row.current_stamp_count} current · {row.total_stamps_earned}{" "}
                total
              </span>
            ),
          },
          {
            key: "rewards",
            header: "Rewards redeemed",
            cell: (row) => (
              <span className="numeric-tabular">
                {row.total_rewards_redeemed}
              </span>
            ),
          },
          {
            key: "joined",
            header: "Joined",
            cell: (row) => (
              <time className="text-muted-foreground" dateTime={row.created_at}>
                {formatAdminDate(row.created_at)}
              </time>
            ),
          },
          {
            key: "action",
            header: "Audited action",
            cell: (row) => <StampAdjustmentForm membershipId={row.id} />,
          },
        ]}
      />
    </AdminPanel>
  )
}

function StampAdjustmentForm({ membershipId }: { membershipId: string }) {
  return (
    <form action={adjustStampsAction} className="grid min-w-[280px] gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="grid gap-2 sm:grid-cols-[96px_1fr]">
        <AdminField label="Delta">
          <input
            name="delta"
            type="number"
            required
            className={adminInputClasses}
          />
        </AdminField>
        <AdminField label="Reason">
          <input
            name="reason"
            required
            minLength={4}
            className={adminInputClasses}
          />
        </AdminField>
      </div>
      <Button type="submit">
        <Icon icon={PlusSignIcon} size={16} />
        Adjust stamps
      </Button>
    </form>
  )
}
